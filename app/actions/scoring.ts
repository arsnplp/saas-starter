'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { leads } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

const scoreLeadSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
  icpCriteria: z.object({
    targetTitles: z.array(z.string()).optional(),
    targetCompanySizes: z.array(z.number()).optional(),
    targetIndustries: z.array(z.string()).optional(),
    targetLocations: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
});

export const scoreLead = validatedActionWithUser(
  scoreLeadSchema,
  async (data, _, user) => {
    const { leadId, teamId, icpCriteria } = data;

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
    });

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    let score = 0;
    const reasons: string[] = [];

    if (lead.sourceMode === 'chaud') {
      score += 30;
      reasons.push('Lead from own post (+30)');
      
      if (lead.engagementType === 'comment') {
        score += 20;
        reasons.push('Engaged with comment (+20)');
      } else if (lead.reactionType === 'PRAISE' || lead.reactionType === 'INTEREST') {
        score += 15;
        reasons.push(`Strong reaction: ${lead.reactionType} (+15)`);
      } else {
        score += 10;
        reasons.push('Reacted to post (+10)');
      }
    } else if (lead.sourceMode === 'espion') {
      score += 20;
      reasons.push('Lead from competitor post (+20)');
      
      if (lead.engagementType === 'comment') {
        score += 15;
        reasons.push('Engaged with comment (+15)');
      } else {
        score += 10;
        reasons.push('Reacted to competitor (+10)');
      }
    } else if (lead.sourceMode === 'magnet') {
      score += 25;
      reasons.push('Filtered lead from targeted search (+25)');
    } else if (lead.sourceMode === 'froid') {
      score += 10;
      reasons.push('Cold lead from search (+10)');
    }

    if (icpCriteria?.targetTitles && lead.title) {
      const titleMatch = icpCriteria.targetTitles.some(
        target => lead.title?.toLowerCase().includes(target.toLowerCase())
      );
      if (titleMatch) {
        score += 20;
        reasons.push('Title matches ICP (+20)');
      }
    }

    if (icpCriteria?.targetIndustries && lead.industry) {
      const industryMatch = icpCriteria.targetIndustries.some(
        target => lead.industry?.toLowerCase().includes(target.toLowerCase())
      );
      if (industryMatch) {
        score += 15;
        reasons.push('Industry matches ICP (+15)');
      }
    }

    if (icpCriteria?.targetCompanySizes && lead.companySize) {
      const sizeMatch = icpCriteria.targetCompanySizes.some(
        targetSize => Math.abs((lead.companySize || 0) - targetSize) < 200
      );
      if (sizeMatch) {
        score += 15;
        reasons.push('Company size matches ICP (+15)');
      }
    }

    if (icpCriteria?.targetLocations && lead.location) {
      const locationMatch = icpCriteria.targetLocations.some(
        target => lead.location?.toLowerCase().includes(target.toLowerCase())
      );
      if (locationMatch) {
        score += 10;
        reasons.push('Location matches ICP (+10)');
      }
    }

    if (lead.profileData) {
      const profileData = lead.profileData as any;
      if (profileData.current_company?.domain) {
        score += 5;
        reasons.push('Has company website (+5)');
      }
      if (profileData.headline?.length > 50) {
        score += 5;
        reasons.push('Detailed headline (+5)');
      }
    }

    score = Math.min(score, 100);

    const [updatedLead] = await db
      .update(leads)
      .set({
        score,
        scoreReason: reasons.join('; '),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return {
      success: true,
      score,
      reasons,
      lead: updatedLead,
    };
  }
);

const batchScoreLeadsSchema = z.object({
  teamId: z.number(),
  sourceMode: z.string().optional(),
  icpCriteria: z.object({
    targetTitles: z.array(z.string()).optional(),
    targetCompanySizes: z.array(z.number()).optional(),
    targetIndustries: z.array(z.string()).optional(),
    targetLocations: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
});

export const batchScoreLeads = validatedActionWithUser(
  batchScoreLeadsSchema,
  async (data, _, user) => {
    const { teamId, sourceMode, icpCriteria } = data;

    const conditions = [eq(leads.teamId, teamId)];
    if (sourceMode) {
      conditions.push(eq(leads.sourceMode, sourceMode));
    }

    const leadsToScore = await db.query.leads.findMany({
      where: and(...conditions),
    });

    const results = [];

    for (const lead of leadsToScore) {
      let score = 0;
      const reasons: string[] = [];

      if (lead.sourceMode === 'chaud') {
        score += 30;
        reasons.push('Lead from own post (+30)');
        
        if (lead.engagementType === 'comment') {
          score += 20;
          reasons.push('Engaged with comment (+20)');
        } else if (lead.reactionType === 'PRAISE' || lead.reactionType === 'INTEREST') {
          score += 15;
          reasons.push(`Strong reaction: ${lead.reactionType} (+15)`);
        } else {
          score += 10;
          reasons.push('Reacted to post (+10)');
        }
      } else if (lead.sourceMode === 'espion') {
        score += 20;
        reasons.push('Lead from competitor post (+20)');
        
        if (lead.engagementType === 'comment') {
          score += 15;
          reasons.push('Engaged with comment (+15)');
        } else {
          score += 10;
          reasons.push('Reacted to competitor (+10)');
        }
      } else if (lead.sourceMode === 'magnet') {
        score += 25;
        reasons.push('Filtered lead from targeted search (+25)');
      } else if (lead.sourceMode === 'froid') {
        score += 10;
        reasons.push('Cold lead from search (+10)');
      }

      if (icpCriteria?.targetTitles && lead.title) {
        const titleMatch = icpCriteria.targetTitles.some(
          target => lead.title?.toLowerCase().includes(target.toLowerCase())
        );
        if (titleMatch) {
          score += 20;
          reasons.push('Title matches ICP (+20)');
        }
      }

      if (icpCriteria?.targetIndustries && lead.industry) {
        const industryMatch = icpCriteria.targetIndustries.some(
          target => lead.industry?.toLowerCase().includes(target.toLowerCase())
        );
        if (industryMatch) {
          score += 15;
          reasons.push('Industry matches ICP (+15)');
        }
      }

      if (icpCriteria?.targetCompanySizes && lead.companySize) {
        const sizeMatch = icpCriteria.targetCompanySizes.some(
          targetSize => Math.abs((lead.companySize || 0) - targetSize) < 200
        );
        if (sizeMatch) {
          score += 15;
          reasons.push('Company size matches ICP (+15)');
        }
      }

      if (icpCriteria?.targetLocations && lead.location) {
        const locationMatch = icpCriteria.targetLocations.some(
          target => lead.location?.toLowerCase().includes(target.toLowerCase())
        );
        if (locationMatch) {
          score += 10;
          reasons.push('Location matches ICP (+10)');
        }
      }

      if (lead.profileData) {
        const profileData = lead.profileData as any;
        if (profileData.current_company?.domain) {
          score += 5;
          reasons.push('Has company website (+5)');
        }
        if (profileData.headline?.length > 50) {
          score += 5;
          reasons.push('Detailed headline (+5)');
        }
      }

      score = Math.min(score, 100);

      const [updatedLead] = await db
        .update(leads)
        .set({
          score,
          scoreReason: reasons.join('; '),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))
        .returning();

      results.push({
        leadId: lead.id,
        score,
        reasons,
      });
    }

    return {
      success: true,
      count: results.length,
      results,
    };
  }
);

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Hot', color: 'red' };
  if (score >= 60) return { label: 'Warm', color: 'orange' };
  if (score >= 40) return { label: 'Qualified', color: 'yellow' };
  if (score >= 20) return { label: 'Cold', color: 'blue' };
  return { label: 'Very Cold', color: 'gray' };
}
