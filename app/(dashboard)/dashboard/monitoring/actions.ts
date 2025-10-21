'use server';

import { db } from '@/lib/db/drizzle';
import {
  monitoredCompanies,
  leadCollectionConfigs,
  companyPosts,
  webhookAccounts,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/db/queries';
import { WebhookManager } from '@/lib/services/webhook-manager';

export async function addMonitoredCompanyAction(data: {
  linkedinCompanyUrl: string;
  companyName: string;
}) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    console.log(`📝 Ajout entreprise suivie: ${data.companyName}`);

    const normalizedUrl = data.linkedinCompanyUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    const existing = await db.query.monitoredCompanies.findFirst({
      where: and(
        eq(monitoredCompanies.teamId, teamId),
        eq(monitoredCompanies.linkedinCompanyUrl, normalizedUrl)
      ),
    });

    if (existing) {
      return { success: false, error: 'Cette entreprise est déjà suivie' };
    }

    const [company] = await db
      .insert(monitoredCompanies)
      .values({
        teamId,
        linkedinCompanyUrl: normalizedUrl,
        companyName: data.companyName,
        addedBy: user.id,
      })
      .returning();

    await db.insert(leadCollectionConfigs).values({
      teamId,
      monitoredCompanyId: company.id,
      delayHours: 24,
      maxReactions: 50,
      maxComments: 50,
      isEnabled: true,
    });

    console.log(`✅ Entreprise ajoutée: ${company.id}`);

    revalidatePath('/dashboard/monitoring');

    return { success: true, company };
  } catch (error: any) {
    console.error('❌ Erreur ajout entreprise:', error);
    return { success: false, error: error.message };
  }
}

export async function removeMonitoredCompanyAction(companyId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    await db
      .delete(monitoredCompanies)
      .where(
        and(
          eq(monitoredCompanies.id, companyId),
          eq(monitoredCompanies.teamId, teamId)
        )
      );

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur suppression entreprise:', error);
    return { success: false, error: error.message };
  }
}

export async function updateCollectionConfigAction(
  companyId: string,
  config: {
    delayHours: number;
    maxReactions: number;
    maxComments: number;
    isEnabled: boolean;
  }
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    const company = await db.query.monitoredCompanies.findFirst({
      where: and(
        eq(monitoredCompanies.id, companyId),
        eq(monitoredCompanies.teamId, teamId)
      ),
      with: {
        collectionConfig: true,
      },
    });

    if (!company) {
      return { success: false, error: 'Entreprise non trouvée' };
    }

    if (company.collectionConfig) {
      await db
        .update(leadCollectionConfigs)
        .set({
          delayHours: config.delayHours,
          maxReactions: config.maxReactions,
          maxComments: config.maxComments,
          isEnabled: config.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(leadCollectionConfigs.id, company.collectionConfig.id));
    } else {
      await db.insert(leadCollectionConfigs).values({
        teamId,
        monitoredCompanyId: companyId,
        ...config,
      });
    }

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur mise à jour config:', error);
    return { success: false, error: error.message };
  }
}

export async function markPostsAsReadAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false };
  }

  try {
    await db
      .update(companyPosts)
      .set({ isNew: false })
      .where(eq(companyPosts.teamId, user.teamId));

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getMonitoringDataAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return {
      companies: [],
      recentPosts: [],
      webhookStatus: { hasAccount: false, isActive: false, accountInfo: null },
      newPostsCount: 0,
    };
  }

  const teamId = user.teamId;

  const companies = await db.query.monitoredCompanies.findMany({
    where: eq(monitoredCompanies.teamId, teamId),
    with: {
      collectionConfig: true,
    },
    orderBy: [desc(monitoredCompanies.lastPostAt)],
  });

  const recentPosts = await db.query.companyPosts.findMany({
    where: eq(companyPosts.teamId, teamId),
    with: {
      monitoredCompany: true,
    },
    orderBy: [desc(companyPosts.publishedAt)],
    limit: 20,
  });

  const webhookStatus = await WebhookManager.getMonitoringStatus(teamId);

  const newPostsCount = await db
    .select({ count: companyPosts.id })
    .from(companyPosts)
    .where(and(eq(companyPosts.teamId, teamId), eq(companyPosts.isNew, true)));

  return {
    companies,
    recentPosts,
    webhookStatus,
    newPostsCount: newPostsCount.length,
  };
}

export async function setupWebhookAccountAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://' + process.env.REPLIT_DEV_DOMAIN}/api/webhook/linkedin`;

    const { linkedinConnections } = await import('@/lib/db/schema');
    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, teamId),
    });

    if (!connection) {
      return {
        success: false,
        error: 'Connexion LinkedIn requise',
      };
    }

    const result = await WebhookManager.createWebhookAccount({
      teamId,
      userId: user.id,
      accountName: `Monitoring ${user.name || 'Team'}`,
      webhookUrl,
      loginToken: connection.loginToken,
      country: 'FR',
    });

    revalidatePath('/dashboard/monitoring');

    return { success: true, account: result.webhookAccount };
  } catch (error: any) {
    console.error('❌ Erreur setup webhook:', error);
    return { success: false, error: error.message };
  }
}

export async function toggleMonitoringAction(enable: boolean) {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false, error: 'Non authentifié' };
  }

  try {
    if (enable) {
      await WebhookManager.startMonitoring(user.teamId);
    } else {
      await WebhookManager.stopMonitoring(user.teamId);
    }

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
