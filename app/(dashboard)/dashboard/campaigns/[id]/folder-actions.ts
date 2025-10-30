'use server';

import { db } from '@/lib/db';
import { 
  campaigns,
  campaignFolders, 
  campaignProspects, 
  campaignExecutions,
  prospectCandidates,
  campaignBlocks,
  prospectFolders
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { revalidatePath } from 'next/cache';

export async function getCampaignFolders(campaignId: number) {
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

  const folders = await db.query.campaignFolders.findMany({
    where: eq(campaignFolders.campaignId, campaignId),
    with: {
      folder: true,
    },
  });

  return { 
    success: true, 
    folders: folders.map(f => ({
      id: f.folder.id,
      name: f.folder.name,
      color: f.folder.color,
    }))
  };
}

export async function assignFolderToCampaign(
  campaignId: number, 
  folderId: string, 
  assign: boolean
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

  const folderIdNum = parseInt(folderId);
  
  if (isNaN(folderIdNum)) {
    return { success: false, error: 'ID de dossier invalide' };
  }

  const folder = await db.query.prospectFolders.findFirst({
    where: and(
      eq(prospectFolders.id, folderIdNum),
      eq(prospectFolders.teamId, team.id)
    ),
  });

  if (!folder) {
    return { success: false, error: 'Dossier non trouvé' };
  }

  if (assign) {
    const existingAssignment = await db.query.campaignFolders.findFirst({
      where: and(
        eq(campaignFolders.campaignId, campaignId),
        eq(campaignFolders.folderId, folderIdNum)
      ),
    });

    if (!existingAssignment) {
      await db.insert(campaignFolders).values({
        campaignId,
        folderId: folderIdNum,
      });
    }

    const prospectsInFolder = await db
      .select()
      .from(prospectCandidates)
      .where(
        and(
          eq(prospectCandidates.folderId, folderIdNum),
          eq(prospectCandidates.teamId, team.id)
        )
      );

    const existingBlocks = await db.query.campaignBlocks.findMany({
      where: eq(campaignBlocks.campaignId, campaignId),
    });

    let addedCount = 0;

    for (const prospect of prospectsInFolder) {
      const existingProspect = await db.query.campaignProspects.findFirst({
        where: and(
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.prospectId, prospect.id)
        ),
      });

      if (!existingProspect) {
        const [newAssignment] = await db
          .insert(campaignProspects)
          .values({
            campaignId,
            prospectId: prospect.id,
          })
          .returning();

        for (const block of existingBlocks) {
          await db.insert(campaignExecutions).values({
            campaignProspectId: newAssignment.id,
            blockId: block.id,
            status: 'pending',
            scheduledAt: new Date(),
          });
        }

        addedCount++;
      }
    }

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    
    return { 
      success: true, 
      prospectCount: addedCount 
    };
  } else {
    const prospectsInFolder = await db
      .select()
      .from(prospectCandidates)
      .where(
        and(
          eq(prospectCandidates.folderId, folderIdNum),
          eq(prospectCandidates.teamId, team.id)
        )
      );

    for (const prospect of prospectsInFolder) {
      await db
        .delete(campaignProspects)
        .where(
          and(
            eq(campaignProspects.campaignId, campaignId),
            eq(campaignProspects.prospectId, prospect.id)
          )
        );
    }

    await db
      .delete(campaignFolders)
      .where(
        and(
          eq(campaignFolders.campaignId, campaignId),
          eq(campaignFolders.folderId, folderIdNum)
        )
      );

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    
    return { success: true };
  }
}
