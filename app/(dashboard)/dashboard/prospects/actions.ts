'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { prospectCandidates, leads, icpProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTeamForUser } from '@/lib/db/queries';
import { fetchLinkedInProfile } from '@/lib/integrations/linkup';
import { scoreProfileAgainstICP, type EnrichedProfile, type ICPCriteria } from '@/lib/integrations/openai';
import { revalidatePath } from 'next/cache';

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
      const profileData = await fetchLinkedInProfile(prospect.profileUrl);
      
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
