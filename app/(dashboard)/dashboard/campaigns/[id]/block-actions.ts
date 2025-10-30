'use server';

import { db } from '@/lib/db';
import { campaignBlocks, campaigns, campaignProspects, campaignExecutions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { revalidatePath } from 'next/cache';

export interface EmailBlockConfig {
  subject: string;
  body: string;
}

export async function createEmailBlock(
  campaignId: number,
  config: EmailBlockConfig
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.teamId, team.id)
    ),
  });

  if (!campaign) {
    return { success: false, error: 'Campagne non trouvée' };
  }

  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${campaignBlocks.order}), -1)` })
    .from(campaignBlocks)
    .where(eq(campaignBlocks.campaignId, campaignId));

  const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

  const [block] = await db
    .insert(campaignBlocks)
    .values({
      campaignId,
      type: 'email',
      config: config as any,
      order: nextOrder,
    })
    .returning();

  const existingProspects = await db.query.campaignProspects.findMany({
    where: eq(campaignProspects.campaignId, campaignId),
  });

  for (const prospect of existingProspects) {
    await db.insert(campaignExecutions).values({
      campaignProspectId: prospect.id,
      blockId: block.id,
      status: 'pending',
      scheduledAt: new Date(),
    });
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true, block };
}

export async function updateEmailBlock(
  blockId: number,
  config: EmailBlockConfig
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const block = await db.query.campaignBlocks.findFirst({
    where: eq(campaignBlocks.id, blockId),
    with: {
      campaign: true,
    },
  });

  if (!block || block.campaign.teamId !== team.id) {
    return { success: false, error: 'Bloc non trouvé' };
  }

  await db
    .update(campaignBlocks)
    .set({
      config: config as any,
      updatedAt: new Date(),
    })
    .where(eq(campaignBlocks.id, blockId));

  revalidatePath(`/dashboard/campaigns/${block.campaignId}`);

  return { success: true };
}

export async function deleteBlock(blockId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const block = await db.query.campaignBlocks.findFirst({
    where: eq(campaignBlocks.id, blockId),
    with: {
      campaign: true,
    },
  });

  if (!block || block.campaign.teamId !== team.id) {
    return { success: false, error: 'Bloc non trouvé' };
  }

  await db.delete(campaignBlocks).where(eq(campaignBlocks.id, blockId));

  const blocks = await db.query.campaignBlocks.findMany({
    where: eq(campaignBlocks.campaignId, block.campaignId),
    orderBy: (blocks, { asc }) => [asc(blocks.order)],
  });

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].order !== i) {
      await db
        .update(campaignBlocks)
        .set({ order: i })
        .where(eq(campaignBlocks.id, blocks[i].id));
    }
  }

  revalidatePath(`/dashboard/campaigns/${block.campaignId}`);

  return { success: true };
}

export const deleteEmailBlock = deleteBlock;

export async function reorderBlocks(campaignId: number, blockIds: number[]) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.teamId, team.id)
    ),
  });

  if (!campaign) {
    return { success: false, error: 'Campagne non trouvée' };
  }

  for (let i = 0; i < blockIds.length; i++) {
    await db
      .update(campaignBlocks)
      .set({ order: i })
      .where(eq(campaignBlocks.id, blockIds[i]));
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true };
}

export async function getCampaignBlocks(campaignId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.teamId, team.id)
    ),
  });

  if (!campaign) {
    return { success: false, error: 'Campagne non trouvée' };
  }

  const blocks = await db.query.campaignBlocks.findMany({
    where: eq(campaignBlocks.campaignId, campaignId),
    orderBy: (blocks, { asc }) => [asc(blocks.order)],
  });

  return { success: true, blocks };
}

export async function addProspectToCampaign(
  campaignId: number,
  prospectId: string
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.teamId, team.id)
    ),
  });

  if (!campaign) {
    return { success: false, error: 'Campagne non trouvée' };
  }

  const existingAssignment = await db.query.campaignProspects.findFirst({
    where: and(
      eq(campaignProspects.campaignId, campaignId),
      eq(campaignProspects.prospectId, prospectId)
    ),
  });

  if (existingAssignment) {
    return { success: false, error: 'Prospect déjà assigné à cette campagne' };
  }

  const [assignment] = await db
    .insert(campaignProspects)
    .values({
      campaignId,
      prospectId,
      addedBy: user.id,
    })
    .returning();

  const blocks = await db.query.campaignBlocks.findMany({
    where: eq(campaignBlocks.campaignId, campaignId),
    orderBy: (blocks, { asc }) => [asc(blocks.order)],
  });

  for (const block of blocks) {
    await db.insert(campaignExecutions).values({
      campaignProspectId: assignment.id,
      blockId: block.id,
      status: 'pending',
      scheduledAt: new Date(),
    });
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true };
}
