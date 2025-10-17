import { db } from '@/lib/db/drizzle';
import { linkedinOAuthCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '784djxuzx9ondt';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

export class LinkedInOAuthService {
  static async getCredentials(teamId: number) {
    const credentials = await db.query.linkedinOAuthCredentials.findFirst({
      where: eq(linkedinOAuthCredentials.teamId, teamId),
    });

    if (!credentials || !credentials.isActive) {
      return null;
    }

    if (this.isExpiringSoon(credentials.expiresAt)) {
      return await this.refreshToken(credentials);
    }

    return credentials;
  }

  static async getValidAccessToken(teamId: number): Promise<string | null> {
    const credentials = await this.getCredentials(teamId);
    return credentials?.accessToken || null;
  }

  static isExpiringSoon(expiresAt: Date): boolean {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(expiresAt) < fiveMinutesFromNow;
  }

  static async refreshToken(credentials: typeof linkedinOAuthCredentials.$inferSelect) {
    if (!credentials.refreshToken) {
      console.error('No refresh token available for team:', credentials.teamId);
      await this.markInactive(credentials.teamId);
      return null;
    }

    if (!LINKEDIN_CLIENT_SECRET) {
      console.error('LINKEDIN_CLIENT_SECRET not configured');
      return credentials;
    }

    try {
      const redirectUri = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://dcbf23d9-46ed-499d-9a94-c2fd5826b035-00-2vo8j2e80ihth.spock.replit.dev'}/api/auth/linkedin/callback`;

      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('LinkedIn token refresh error:', errorData);
        await this.markInactive(credentials.teamId);
        return null;
      }

      const tokenData = await response.json();

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000);

      const updated = await db
        .update(linkedinOAuthCredentials)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || credentials.refreshToken,
          expiresAt,
          lastRefreshedAt: new Date(),
        })
        .where(eq(linkedinOAuthCredentials.teamId, credentials.teamId))
        .returning();

      console.log('LinkedIn token refreshed successfully for team:', credentials.teamId);

      return updated[0] || null;

    } catch (error) {
      console.error('LinkedIn token refresh failed:', error);
      await this.markInactive(credentials.teamId);
      return null;
    }
  }

  static async markInactive(teamId: number) {
    await db
      .update(linkedinOAuthCredentials)
      .set({ isActive: false })
      .where(eq(linkedinOAuthCredentials.teamId, teamId));
  }

  static async disconnect(teamId: number) {
    await db
      .delete(linkedinOAuthCredentials)
      .where(eq(linkedinOAuthCredentials.teamId, teamId));
  }

  static async getConnectionStatus(teamId: number) {
    const credentials = await db.query.linkedinOAuthCredentials.findFirst({
      where: eq(linkedinOAuthCredentials.teamId, teamId),
      with: {
        connectedByUser: true,
      },
    });

    if (!credentials) {
      return {
        isConnected: false,
        connectedAt: null,
        connectedBy: null,
        expiresAt: null,
        isExpiringSoon: false,
      };
    }

    return {
      isConnected: credentials.isActive,
      connectedAt: credentials.connectedAt?.toISOString() || null,
      connectedBy: credentials.connectedByUser?.name || credentials.connectedByUser?.email || null,
      expiresAt: credentials.expiresAt?.toISOString() || null,
      lastRefreshedAt: credentials.lastRefreshedAt?.toISOString() || null,
      isExpiringSoon: this.isExpiringSoon(credentials.expiresAt),
    };
  }
}
