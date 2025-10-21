import { db } from '@/lib/db/drizzle';
import { webhookAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const LINKUP_API_BASE = process.env.LINKUP_API_BASE || 'https://api.linkupapi.com';
const LINKUP_API_KEY = process.env.LINKUP_API_KEY;

export interface CreateWebhookAccountParams {
  teamId: number;
  userId: number;
  accountName: string;
  webhookUrl: string;
  loginToken: string;
  country?: string;
}

export interface WebhookAccountInfo {
  id: string;
  plateforme: string;
  account_name: string;
  webhook_url: string;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class WebhookManager {
  private static async callLinkUpAPI<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: any
  ): Promise<T> {
    if (!LINKUP_API_KEY) {
      throw new Error('LINKUP_API_KEY non configurée');
    }

    const url = `${LINKUP_API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LINKUP_API_KEY,
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    console.log(`[WebhookManager] ${method} ${url}`);
    
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[WebhookManager] API Error:`, data);
      throw new Error(
        `LinkUp Webhook API ${response.status}: ${data.message || JSON.stringify(data)}`
      );
    }

    return data as T;
  }

  static async createWebhookAccount(params: CreateWebhookAccountParams): Promise<{
    webhookAccount: typeof webhookAccounts.$inferSelect;
    linkupInfo: WebhookAccountInfo;
  }> {
    const {
      teamId,
      userId,
      accountName,
      webhookUrl,
      loginToken,
      country = 'FR',
    } = params;

    console.log(`🔧 Création compte webhook pour team ${teamId}...`);

    const existingAccount = await db.query.webhookAccounts.findFirst({
      where: eq(webhookAccounts.teamId, teamId),
    });

    if (existingAccount) {
      throw new Error('Un compte webhook existe déjà pour cette équipe');
    }

    const linkupResponse = await this.callLinkUpAPI<WebhookAccountInfo>(
      '/v1/webhooks/accounts',
      'POST',
      {
        plateforme: 'linkedin',
        account_name: accountName,
        webhook_url: webhookUrl,
        login_token: loginToken,
        country,
      }
    );

    console.log(`✅ Compte webhook créé sur LinkUp: ${linkupResponse.id}`);

    const [webhookAccount] = await db
      .insert(webhookAccounts)
      .values({
        teamId,
        linkupAccountId: linkupResponse.id,
        accountName: linkupResponse.account_name,
        webhookUrl: linkupResponse.webhook_url,
        country: linkupResponse.country,
        isActive: linkupResponse.is_active,
        createdBy: userId,
      })
      .returning();

    console.log(`💾 Compte webhook sauvegardé en base: ${webhookAccount.id}`);

    return {
      webhookAccount,
      linkupInfo: linkupResponse,
    };
  }

  static async startMonitoring(teamId: number): Promise<{
    account: typeof webhookAccounts.$inferSelect;
    linkupInfo: WebhookAccountInfo;
  }> {
    console.log(`▶️ Démarrage monitoring pour team ${teamId}...`);

    const account = await db.query.webhookAccounts.findFirst({
      where: eq(webhookAccounts.teamId, teamId),
    });

    if (!account) {
      throw new Error('Aucun compte webhook trouvé pour cette équipe');
    }

    const linkupResponse = await this.callLinkUpAPI<WebhookAccountInfo>(
      `/v1/webhooks/accounts/${account.linkupAccountId}/start`,
      'POST'
    );

    console.log(`✅ Monitoring démarré: ${linkupResponse.is_active}`);

    const [updatedAccount] = await db
      .update(webhookAccounts)
      .set({
        isActive: linkupResponse.is_active,
        lastStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookAccounts.id, account.id))
      .returning();

    return {
      account: updatedAccount,
      linkupInfo: linkupResponse,
    };
  }

  static async stopMonitoring(teamId: number): Promise<{
    account: typeof webhookAccounts.$inferSelect;
    linkupInfo: WebhookAccountInfo;
  }> {
    console.log(`⏸️ Arrêt monitoring pour team ${teamId}...`);

    const account = await db.query.webhookAccounts.findFirst({
      where: eq(webhookAccounts.teamId, teamId),
    });

    if (!account) {
      throw new Error('Aucun compte webhook trouvé pour cette équipe');
    }

    const linkupResponse = await this.callLinkUpAPI<WebhookAccountInfo>(
      `/v1/webhooks/accounts/${account.linkupAccountId}/stop`,
      'POST'
    );

    console.log(`✅ Monitoring arrêté: ${linkupResponse.is_active}`);

    const [updatedAccount] = await db
      .update(webhookAccounts)
      .set({
        isActive: linkupResponse.is_active,
        lastStoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookAccounts.id, account.id))
      .returning();

    return {
      account: updatedAccount,
      linkupInfo: linkupResponse,
    };
  }

  static async updateWebhookAccount(
    teamId: number,
    updates: {
      accountName?: string;
      webhookUrl?: string;
      loginToken?: string;
      country?: string;
    }
  ): Promise<{
    account: typeof webhookAccounts.$inferSelect;
    linkupInfo: WebhookAccountInfo;
  }> {
    console.log(`🔄 Mise à jour compte webhook pour team ${teamId}...`);

    const account = await db.query.webhookAccounts.findFirst({
      where: eq(webhookAccounts.teamId, teamId),
    });

    if (!account) {
      throw new Error('Aucun compte webhook trouvé pour cette équipe');
    }

    const updatePayload: any = {};
    if (updates.accountName) updatePayload.account_name = updates.accountName;
    if (updates.webhookUrl) updatePayload.webhook_url = updates.webhookUrl;
    if (updates.loginToken) updatePayload.login_token = updates.loginToken;
    if (updates.country) updatePayload.country = updates.country;

    const linkupResponse = await this.callLinkUpAPI<WebhookAccountInfo>(
      `/v1/webhooks/accounts/${account.linkupAccountId}`,
      'PUT',
      updatePayload
    );

    console.log(`✅ Compte webhook mis à jour sur LinkUp`);

    const [updatedAccount] = await db
      .update(webhookAccounts)
      .set({
        accountName: linkupResponse.account_name,
        webhookUrl: linkupResponse.webhook_url,
        country: linkupResponse.country,
        updatedAt: new Date(),
      })
      .where(eq(webhookAccounts.id, account.id))
      .returning();

    return {
      account: updatedAccount,
      linkupInfo: linkupResponse,
    };
  }

  static async getWebhookAccount(teamId: number) {
    return await db.query.webhookAccounts.findFirst({
      where: eq(webhookAccounts.teamId, teamId),
    });
  }

  static async getMonitoringStatus(teamId: number): Promise<{
    hasAccount: boolean;
    isActive: boolean;
    accountInfo: typeof webhookAccounts.$inferSelect | null;
  }> {
    const account = await this.getWebhookAccount(teamId);

    return {
      hasAccount: !!account,
      isActive: account?.isActive || false,
      accountInfo: account || null,
    };
  }
}
