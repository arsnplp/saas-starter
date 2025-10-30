'use server';

import { db } from '@/lib/db';
import { 
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

  if (assign) {
    const existingAssignment = await db.query.campaignFolders.findFirst({
      where: and(
        eq(campaignFolders.campaignId, campaignId),
        eq(campaignFolders.folderId, folderId)
      ),
    });

    if (!existingAssignment) {
      await db.insert(campaignFolders).values({
        campaignId,
        folderId,
      });
    }

    const prospectsInFolder = await db
      .select()
      .from(prospectCandidates)
      .where(
        and(
          eq(prospectCandidates.folderId, folderId),
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
    await db
      .delete(campaignFolders)
      .where(
        and(
          eq(campaignFolders.campaignId, campaignId),
          eq(campaignFolders.folderId, folderId)
        )
      );

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    
    return { success: true };
  }
}
