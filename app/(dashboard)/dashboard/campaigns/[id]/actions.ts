'use server';

import { db } from '@/lib/db';
import { campaigns, campaignProspects } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

export async function getCampaignWithDetails(campaignId: number) {
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

  const prospectCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignProspects)
    .where(eq(campaignProspects.campaignId, campaignId));

  const prospectCount = prospectCountResult[0]?.count || 0;

  return {
    success: true,
    campaign: {
      ...campaign,
      prospectCount: Number(prospectCount),
    },
  };
}
