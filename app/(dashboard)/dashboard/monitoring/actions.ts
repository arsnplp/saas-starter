'use server';

import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  monitoredCompanies,
  companyPosts,
  leadCollectionConfigs,
  scheduledCollections,
  activityLogs,
  type MonitoredCompany,
  type CompanyPost,
  type LeadCollectionConfig,
  type ScheduledCollection,
} from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { validatedAction, validatedActionWithUser } from '@/lib/auth/middleware';

const addMonitoredProfileSchema = z.object({
  linkedinUrl: z.string().url('URL LinkedIn invalide'),
  profileName: z.string().min(1, 'Le nom du profil est requis'),
  profileType: z.enum(['company', 'personal']),
  delayHours: z.number().min(1).max(168).default(24),
});

export const addMonitoredProfile = validatedActionWithUser(
  addMonitoredProfileSchema,
  async (data, _, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    const existing = await db
      .select()
      .from(monitoredCompanies)
      .where(
        and(
          eq(monitoredCompanies.teamId, teamId),
          eq(monitoredCompanies.linkedinCompanyUrl, data.linkedinUrl)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { error: 'Ce profil est déjà surveillé' };
    }

    const [newProfile] = await db
      .insert(monitoredCompanies)
      .values({
        teamId,
        linkedinCompanyUrl: data.linkedinUrl,
        companyName: data.profileName,
        profileType: data.profileType,
        isActive: true,
        addedBy: user.id,
      })
      .returning();

    await db.insert(leadCollectionConfigs).values({
      teamId,
      monitoredCompanyId: newProfile.id,
      delayHours: data.delayHours,
      maxReactions: 50,
      maxComments: 50,
      isEnabled: true,
    });

    await db.insert(activityLogs).values({
      teamId,
      userId: user.id,
      action: `Ajout du profil LinkedIn surveillé: ${data.profileName}`,
      ipAddress: '',
    });

    return { success: true, profile: newProfile };
  }
);

export const getMonitoredProfiles = validatedActionWithUser(
  z.object({}),
  async (_, __, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    const profiles = await db
      .select({
        id: monitoredCompanies.id,
        linkedinCompanyUrl: monitoredCompanies.linkedinCompanyUrl,
        companyName: monitoredCompanies.companyName,
        profileType: monitoredCompanies.profileType,
        logoUrl: monitoredCompanies.logoUrl,
        isActive: monitoredCompanies.isActive,
        addedAt: monitoredCompanies.addedAt,
        lastPostAt: monitoredCompanies.lastPostAt,
        lastCheckedAt: monitoredCompanies.lastCheckedAt,
        totalPostsReceived: monitoredCompanies.totalPostsReceived,
        delayHours: leadCollectionConfigs.delayHours,
        isEnabled: leadCollectionConfigs.isEnabled,
      })
      .from(monitoredCompanies)
      .leftJoin(
        leadCollectionConfigs,
        eq(leadCollectionConfigs.monitoredCompanyId, monitoredCompanies.id)
      )
      .where(eq(monitoredCompanies.teamId, teamId))
      .orderBy(desc(monitoredCompanies.addedAt));

    return { success: true, profiles };
  }
);

const deleteMonitoredProfileSchema = z.object({
  profileId: z.string().uuid(),
});

export const deleteMonitoredProfile = validatedActionWithUser(
  deleteMonitoredProfileSchema,
  async (data, _, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    const [profile] = await db
      .select()
      .from(monitoredCompanies)
      .where(
        and(
          eq(monitoredCompanies.id, data.profileId),
          eq(monitoredCompanies.teamId, teamId)
        )
      )
      .limit(1);

    if (!profile) {
      return { error: 'Profil non trouvé' };
    }

    await db.delete(scheduledCollections).where(
      and(
        eq(scheduledCollections.teamId, teamId),
        sql`${scheduledCollections.postId} IN (SELECT id FROM ${companyPosts} WHERE ${companyPosts.monitoredCompanyId} = ${data.profileId})`
      )
    );

    await db
      .delete(companyPosts)
      .where(
        and(
          eq(companyPosts.monitoredCompanyId, data.profileId),
          eq(companyPosts.teamId, teamId)
        )
      );

    await db
      .delete(leadCollectionConfigs)
      .where(
        and(
          eq(leadCollectionConfigs.monitoredCompanyId, data.profileId),
          eq(leadCollectionConfigs.teamId, teamId)
        )
      );

    await db
      .delete(monitoredCompanies)
      .where(
        and(
          eq(monitoredCompanies.id, data.profileId),
          eq(monitoredCompanies.teamId, teamId)
        )
      );

    await db.insert(activityLogs).values({
      teamId,
      userId: user.id,
      action: `Suppression du profil surveillé: ${profile.companyName}`,
      ipAddress: '',
    });

    return { success: true };
  }
);

const toggleProfileActiveSchema = z.object({
  profileId: z.string().uuid(),
  isActive: z.boolean(),
});

export const toggleProfileActive = validatedActionWithUser(
  toggleProfileActiveSchema,
  async (data, _, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    await db
      .update(monitoredCompanies)
      .set({ isActive: data.isActive })
      .where(
        and(
          eq(monitoredCompanies.id, data.profileId),
          eq(monitoredCompanies.teamId, teamId)
        )
      );

    return { success: true };
  }
);

export const getDetectedPosts = validatedActionWithUser(
  z.object({ profileId: z.string().uuid().optional() }),
  async (data, _, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    const whereConditions = [eq(companyPosts.teamId, teamId)];
    if (data.profileId) {
      whereConditions.push(eq(companyPosts.monitoredCompanyId, data.profileId));
    }

    const posts = await db
      .select({
        id: companyPosts.id,
        postUrl: companyPosts.postUrl,
        authorName: companyPosts.authorName,
        content: companyPosts.content,
        publishedAt: companyPosts.publishedAt,
        receivedAt: companyPosts.receivedAt,
        isNew: companyPosts.isNew,
        profileName: monitoredCompanies.companyName,
        profileType: monitoredCompanies.profileType,
        scheduledFor: scheduledCollections.scheduledFor,
        collectionStatus: scheduledCollections.status,
        leadsCreated: scheduledCollections.leadsCreated,
        reactionsCollected: scheduledCollections.reactionsCollected,
        commentsCollected: scheduledCollections.commentsCollected,
      })
      .from(companyPosts)
      .leftJoin(
        monitoredCompanies,
        eq(monitoredCompanies.id, companyPosts.monitoredCompanyId)
      )
      .leftJoin(scheduledCollections, eq(scheduledCollections.postId, companyPosts.id))
      .where(and(...whereConditions))
      .orderBy(desc(companyPosts.publishedAt))
      .limit(100);

    return { success: true, posts };
  }
);

const updateCollectionConfigSchema = z.object({
  profileId: z.string().uuid(),
  delayHours: z.number().min(1).max(168),
  maxReactions: z.number().min(0).max(500),
  maxComments: z.number().min(0).max(500),
});

export const updateCollectionConfig = validatedActionWithUser(
  updateCollectionConfigSchema,
  async (data, _, user) => {
    const teamId = user.teamId;
    if (!teamId) {
      return { error: 'Team non trouvée' };
    }

    await db
      .update(leadCollectionConfigs)
      .set({
        delayHours: data.delayHours,
        maxReactions: data.maxReactions,
        maxComments: data.maxComments,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leadCollectionConfigs.monitoredCompanyId, data.profileId),
          eq(leadCollectionConfigs.teamId, teamId)
        )
      );

    return { success: true };
  }
);
