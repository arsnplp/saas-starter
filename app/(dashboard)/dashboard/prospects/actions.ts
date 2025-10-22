'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { prospectCandidates, leads, icpProfiles, prospectFolders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTeamForUser } from '@/lib/db/queries';
import { fetchLinkedInProfile } from '@/lib/integrations/linkup';
import { scoreProfileAgainstICP, type EnrichedProfile, type ICPCriteria } from '@/lib/integrations/openai';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const scoreProspectSchema = z.object({
  prospectId: z.string().uuid(),
});

export const scoreProspect = validatedActionWithUser(
  scoreProspectSchema,
  async (data, _, user) => {
    const team = await getTeamForUser();
    if (!team) {
      throw new Error('Équipe non trouvée');
    }

    const prospect = await db.query.prospectCandidates.findFirst({
      where: and(
        eq(prospectCandidates.id, data.prospectId),
        eq(prospectCandidates.teamId, team.id)
      ),
    });

    if (!prospect) {
      throw new Error('Prospect non trouvé');
    }

    const icp = await db.query.icpProfiles.findFirst({
      where: eq(icpProfiles.teamId, team.id),
      orderBy: (icpProfiles, { desc }) => [desc(icpProfiles.createdAt)],
    });

    if (!icp) {
      throw new Error('Veuillez d\'abord configurer votre ICP dans les paramètres');
    }

    let enrichedProfile: EnrichedProfile | null = null;

    if (!prospect.enrichedProfile) {
      try {
        const profileData = await fetchLinkedInProfile(prospect.profileUrl, team.id);
        
        enrichedProfile = {
          name: profileData.name || prospect.name || undefined,
          headline: profileData.headline || prospect.title || undefined,
          location: profileData.location || prospect.location || undefined,
          industry: profileData.industry || undefined,
          experience: profileData.experience || [],
          education: profileData.education || [],
          skills: profileData.skills || [],
          summary: profileData.summary || undefined,
        };

        await db
          .update(prospectCandidates)
          .set({ enrichedProfile: enrichedProfile as any })
          .where(eq(prospectCandidates.id, data.prospectId));
      } catch (error) {
        console.error('Enrichissement échoué:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        throw new Error(
          `❌ Impossible d'enrichir ce profil LinkedIn.\n\n` +
          `Détail: ${errorMessage}\n\n` +
          `Solutions possibles:\n` +
          `• Vérifiez votre connexion LinkUp dans Intégrations\n` +
          `• Vérifiez vos crédits LinkUp restants\n` +
          `• Reconnectez-vous si votre session est expirée`
        );
      }
    } else {
      enrichedProfile = prospect.enrichedProfile as EnrichedProfile;
    }

    const icpCriteria: ICPCriteria = {
      industries: icp.industries ? icp.industries.split(',').map(s => s.trim()) : [],
      locations: icp.locations ? icp.locations.split(',').map(s => s.trim()) : [],
      buyerRoles: icp.buyerRoles ? icp.buyerRoles.split(',').map(s => s.trim()) : [],
      keywordsInclude: icp.keywordsInclude ? icp.keywordsInclude.split(',').map(s => s.trim()) : [],
      keywordsExclude: icp.keywordsExclude ? icp.keywordsExclude.split(',').map(s => s.trim()) : [],
      companySizeMin: icp.companySizeMin,
      companySizeMax: icp.companySizeMax,
      minScore: icp.minScore,
      problemStatement: icp.problemStatement || undefined,
      idealCustomerExample: icp.idealCustomerExample || undefined,
    };

    const scoringResult = await scoreProfileAgainstICP(enrichedProfile, icpCriteria);

    await db
      .update(prospectCandidates)
      .set({
        aiScore: scoringResult.score,
        aiReasoning: scoringResult.reasoning,
        status: scoringResult.shouldConvertToLead ? 'converted' : 'analyzed',
      })
      .where(eq(prospectCandidates.id, data.prospectId));

    if (scoringResult.shouldConvertToLead) {
      const nameParts = (enrichedProfile.name || prospect.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await db.insert(leads).values({
        teamId: team.id,
        firstName,
        lastName,
        company: prospect.company || enrichedProfile.experience?.[0]?.company || null,
        title: enrichedProfile.headline || prospect.title || null,
        location: enrichedProfile.location || prospect.location || null,
        industry: enrichedProfile.industry || null,
        linkedinUrl: prospect.profileUrl,
        score: scoringResult.score,
        scoreReason: scoringResult.reasoning,
        sourceMode: 'chaud',
        sourcePostUrl: prospect.postUrl || null,
        engagementType: prospect.action,
        reactionType: prospect.reactionType || null,
        commentText: prospect.commentText || null,
        profileData: enrichedProfile as any,
        status: 'new',
      });
    }

    revalidatePath('/dashboard/prospects');
    revalidatePath('/dashboard/leads');

    return {
      success: true,
      score: scoringResult.score,
      converted: scoringResult.shouldConvertToLead,
      reasoning: scoringResult.reasoning,
    };
  }
);

export async function createProspectFolder(formData: FormData) {
  'use server';
  
  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const name = String(formData.get('name') || '').trim();
  const color = String(formData.get('color') || '#3b82f6');

  if (!name) {
    return { success: false, error: 'Nom du dossier requis' };
  }

  try {
    await db.insert(prospectFolders).values({
      teamId: team.id,
      name,
      color,
      icon: 'folder',
      isDefault: false,
    });

    revalidatePath('/dashboard/prospects');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    return { success: false, error: 'Erreur lors de la création du dossier' };
  }
}

export async function deleteProspects(prospectIds: number[]) {
  'use server';
  
  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  if (!prospectIds || prospectIds.length === 0) {
    return { success: false, error: 'Aucun prospect sélectionné' };
  }

  try {
    for (const id of prospectIds) {
      await db
        .delete(prospectCandidates)
        .where(and(
          eq(prospectCandidates.id, id),
          eq(prospectCandidates.teamId, team.id)
        ));
    }

    revalidatePath('/dashboard/prospects');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    return { success: false, error: 'Erreur lors de la suppression' };
  }
}

export async function moveProspectsToFolder(prospectIds: number[], targetFolderId: number) {
  'use server';
  
  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  if (!prospectIds || prospectIds.length === 0) {
    return { success: false, error: 'Aucun prospect sélectionné' };
  }

  const targetFolder = await db.query.prospectFolders.findFirst({
    where: and(
      eq(prospectFolders.id, targetFolderId),
      eq(prospectFolders.teamId, team.id)
    ),
  });

  if (!targetFolder) {
    return { success: false, error: 'Dossier de destination non trouvé' };
  }

  try {
    for (const id of prospectIds) {
      await db
        .update(prospectCandidates)
        .set({ folderId: targetFolderId })
        .where(and(
          eq(prospectCandidates.id, id),
          eq(prospectCandidates.teamId, team.id)
        ));
    }

    revalidatePath('/dashboard/prospects');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du déplacement:', error);
    return { success: false, error: 'Erreur lors du déplacement' };
  }
}

export async function convertProspectsToLeads(prospectIds: number[]) {
  'use server';
  
  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  if (!prospectIds || prospectIds.length === 0) {
    return { success: false, error: 'Aucun prospect sélectionné' };
  }

  try {
    for (const id of prospectIds) {
      const prospect = await db.query.prospectCandidates.findFirst({
        where: and(
          eq(prospectCandidates.id, id),
          eq(prospectCandidates.teamId, team.id)
        ),
      });

      if (!prospect) continue;

      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.linkedinUrl, prospect.profileUrl),
          eq(leads.teamId, team.id)
        ),
      });

      if (!existingLead) {
        const nameParts = (prospect.name || '').split(' ');
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(' ') || null;

        await db.insert(leads).values({
          teamId: team.id,
          firstName,
          lastName,
          email: null,
          company: prospect.company,
          title: prospect.title,
          linkedinUrl: prospect.profileUrl,
          source: 'linkedin_conversion',
          notes: prospect.commentText ? `Commentaire: ${prospect.commentText}` : null,
        });
      }

      await db
        .update(prospectCandidates)
        .set({ status: 'converted' })
        .where(eq(prospectCandidates.id, id));
    }

    revalidatePath('/dashboard/prospects');
    revalidatePath('/dashboard/leads');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la conversion:', error);
    return { success: false, error: 'Erreur lors de la conversion' };
  }
}
