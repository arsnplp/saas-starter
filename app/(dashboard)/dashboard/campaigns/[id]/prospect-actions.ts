'use server';

import { db } from '@/lib/db';
import { campaignProspects, campaignExecutions, prospectCandidates, campaignBlocks } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { revalidatePath } from 'next/cache';

export async function getCampaignProspects(campaignId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const prospects = await db.query.campaignProspects.findMany({
    where: eq(campaignProspects.campaignId, campaignId),
    with: {
      prospect: true,
      executions: true,
    },
  });

  const prospectsWithStats = prospects.map(p => {
    const executionStats = {
      pending: p.executions.filter(e => e.status === 'pending').length,
      done: p.executions.filter(e => e.status === 'done').length,
      failed: p.executions.filter(e => e.status === 'failed').length,
    };

    return {
      id: p.prospect.id,
      name: p.prospect.name,
      title: p.prospect.title,
      company: p.prospect.company,
      email: p.prospect.email,
      executionStats,
    };
  });

  return { success: true, prospects: prospectsWithStats };
}

export async function removeProspectFromCampaign(campaignId: number, prospectId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const assignment = await db.query.campaignProspects.findFirst({
    where: and(
      eq(campaignProspects.campaignId, campaignId),
      eq(campaignProspects.prospectId, prospectId)
    ),
  });

  if (!assignment) {
    return { success: false, error: 'Assignment non trouvé' };
  }

  await db
    .delete(campaignProspects)
    .where(eq(campaignProspects.id, assignment.id));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true };
}
