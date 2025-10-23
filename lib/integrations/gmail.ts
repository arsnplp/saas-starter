import { db } from '@/lib/db/drizzle';
import { gmailConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  labelIds: string[];
  body?: string;
}

export class GmailClient {
  private accessToken: string;
  private refreshToken: string | null;
  private expiresAt: Date;
  private teamId: number;

  constructor(accessToken: string, refreshToken: string | null, expiresAt: Date, teamId: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    this.teamId = teamId;
  }

  static async getClient(teamId: number): Promise<GmailClient> {
    const connection = await db.query.gmailConnections.findFirst({
      where: eq(gmailConnections.teamId, teamId),
    });

    if (!connection || !connection.isActive) {
      throw new Error('Gmail not connected for this team');
    }

    const client = new GmailClient(
      connection.accessToken,
      connection.refreshToken,
      connection.expiresAt,
      teamId
    );

    if (new Date() >= connection.expiresAt) {
      await client.refreshAccessToken();
    }

    return client;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;
    this.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .update(gmailConnections)
      .set({
        accessToken: this.accessToken,
        expiresAt: this.expiresAt,
        lastRefreshedAt: new Date(),
      })
      .where(eq(gmailConnections.teamId, this.teamId));
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async listMessages(maxResults: number = 20, pageToken?: string): Promise<{ messages: GmailMessage[], nextPageToken?: string }> {
    const params = new URLSearchParams({
      userId: 'me',
      maxResults: maxResults.toString(),
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await this.makeRequest(`/users/me/messages?${params.toString()}`);

    if (!response.messages) {
      return { messages: [] };
    }

    const messages = await Promise.all(
      response.messages.map(async (msg: any) => {
        return this.getMessage(msg.id);
      })
    );

    return {
      messages,
      nextPageToken: response.nextPageToken,
    };
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const response = await this.makeRequest(`/users/me/messages/${messageId}?format=full`);

    const headers = response.payload.headers;
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    let body = '';
    if (response.payload.body.data) {
      body = Buffer.from(response.payload.body.data, 'base64').toString('utf-8');
    } else if (response.payload.parts) {
      const textPart = response.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    return {
      id: response.id,
      threadId: response.threadId,
      snippet: response.snippet,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      labelIds: response.labelIds || [],
      body,
    };
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body,
    ].join('\r\n');

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await this.makeRequest('/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });
  }

  async getProfile(): Promise<{ emailAddress: string }> {
    return this.makeRequest('/users/me/profile');
  }
}

export async function getGmailClient(teamId: number): Promise<GmailClient> {
  return GmailClient.getClient(teamId);
}
