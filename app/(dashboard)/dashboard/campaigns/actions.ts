'use server';

import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { revalidatePath } from 'next/cache';

export async function createCampaign(data: {
  name: string;
  description: string | null;
  blocks: any[];
}) {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const team = await getTeamForUser();
    if (!team) {
      return { success: false, error: 'Accès refusé' };
    }

    await db.insert(campaigns).values({
      teamId: team.id,
      createdBy: user.id,
      name: data.name,
      description: data.description,
      blocks: data.blocks,
      isActive: true,
    });

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error) {
    console.error('Error creating campaign:', error);
    return { success: false, error: 'Erreur lors de la création' };
  }
}

export async function updateCampaign(
  campaignId: number,
  data: {
    name: string;
    description: string | null;
    blocks: any[];
  }
) {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const team = await getTeamForUser();
    if (!team) {
      return { success: false, error: 'Accès refusé' };
    }

    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)))
      .limit(1);

    if (existingCampaign.length === 0) {
      return { success: false, error: 'Campagne introuvable' };
    }

    await db
      .update(campaigns)
      .set({
        name: data.name,
        description: data.description,
        blocks: data.blocks,
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)));

    revalidatePath('/dashboard/campaigns');
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating campaign:', error);
    return { success: false, error: 'Erreur lors de la mise à jour' };
  }
}

export async function deleteCampaign(campaignId: number) {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const team = await getTeamForUser();
    if (!team) {
      return { success: false, error: 'Accès refusé' };
    }

    await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)));

    revalidatePath('/dashboard/campaigns');
    return { success: true };
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return { success: false, error: 'Erreur lors de la suppression' };
  }
}

export async function toggleCampaignStatus(campaignId: number, isActive: boolean) {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const team = await getTeamForUser();
    if (!team) {
      return { success: false, error: 'Accès refusé' };
    }

    await db
      .update(campaigns)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)));

    revalidatePath('/dashboard/campaigns');
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    console.error('Error toggling campaign status:', error);
    return { success: false, error: 'Erreur lors du changement de statut' };
  }
}
