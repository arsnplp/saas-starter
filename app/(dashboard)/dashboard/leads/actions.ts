'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { leads, postEngagements } from '@/lib/db/schema';
import { getLinkupClient, type LinkupPostEngagement } from '@/lib/integrations/linkup';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';

const importLeadsFromPostSchema = z.object({
  postUrl: z.string().url(),
  sourceMode: z.enum(['chaud', 'espion']),
  teamId: z.string().transform(Number),
});

export const importLeadsFromPost = validatedActionWithUser(
  importLeadsFromPostSchema,
  async (data, _, user) => {
    const { postUrl, sourceMode, teamId } = data;

    const linkupClient = await getLinkupClient(teamId);
    const engagement = await linkupClient.getPostEngagement(postUrl);

    const newLeads = [];

    for (const reaction of engagement.reactions) {
      if (!reaction.profile_url) continue;

      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.linkedinUrl, reaction.profile_url),
          eq(leads.teamId, teamId)
        ),
      });

      if (existingLead) continue;

      const nameParts = (reaction.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const [lead] = await db.insert(leads).values({
        teamId,
        firstName,
        lastName,
        linkedinUrl: reaction.profile_url,
        profilePictureUrl: reaction.profile_picture,
        title: reaction.subtitle,
        sourceMode,
        sourcePostUrl: postUrl,
        engagementType: 'reaction',
        reactionType: reaction.type,
        status: 'new',
        score: 0,
        profileData: reaction,
      }).returning();

      newLeads.push(lead);
    }

    for (const comment of engagement.comments) {
      const profileUrl = comment.commenter?.linkedin_url || comment.commenter_profile_url;
      const commenterName = comment.commenter?.name || comment.commenter_name || '';
      const commenterHeadline = comment.commenter?.occupation || comment.commenter_headline || '';
      
      if (!profileUrl) continue;

      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.linkedinUrl, profileUrl),
          eq(leads.teamId, teamId)
        ),
      });

      if (existingLead) continue;

      const nameParts = commenterName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const [lead] = await db.insert(leads).values({
        teamId,
        firstName,
        lastName,
        linkedinUrl: profileUrl,
        profilePictureUrl: comment.commenter_profile_picture,
        title: commenterHeadline,
        sourceMode,
        sourcePostUrl: postUrl,
        engagementType: 'comment',
        commentText: comment.comment_text,
        status: 'new',
        score: 0,
        profileData: comment,
      }).returning();

      newLeads.push(lead);
    }

    for (const reaction of engagement.reactions) {
      await db.insert(postEngagements).values({
        postUrl,
        actorProfileUrl: reaction.profile_url,
        actorName: reaction.name,
        type: 'REACTION',
        reactionType: reaction.type,
        reactedAt: new Date(),
      });
    }

    for (const comment of engagement.comments) {
      const profileUrl = comment.commenter?.linkedin_url || comment.commenter_profile_url;
      const commenterName = comment.commenter?.name || comment.commenter_name || '';
      
      if (!profileUrl) continue;

      await db.insert(postEngagements).values({
        postUrl,
        actorProfileUrl: profileUrl,
        actorName: commenterName,
        type: 'COMMENT',
        commentText: comment.comment_text,
        reactedAt: comment.commented_at ? new Date(comment.commented_at) : new Date(),
      });
    }

    return {
      success: true,
      count: newLeads.length,
      leads: newLeads,
    };
  }
);

const enrichLeadSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
});

export const enrichLead = validatedActionWithUser(
  enrichLeadSchema,
  async (data, _, user) => {
    const { leadId, teamId } = data;

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
    });

    if (!lead || !lead.linkedinUrl) {
      return { success: false, error: 'Lead not found or missing LinkedIn URL' };
    }

    const linkupClient = await getLinkupClient(teamId);
    const profile = await linkupClient.getProfile(lead.linkedinUrl);

    const [updatedLead] = await db
      .update(leads)
      .set({
        firstName: profile.first_name || lead.firstName,
        lastName: profile.last_name || lead.lastName,
        title: profile.headline || lead.title,
        location: profile.location || lead.location,
        company: profile.current_company?.name || lead.company,
        companySize: profile.current_company?.size || lead.companySize,
        companyDomain: profile.current_company?.domain || lead.companyDomain,
        industry: profile.current_company?.industry || lead.industry,
        profilePictureUrl: profile.profile_picture_url || lead.profilePictureUrl,
        profileData: profile,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return {
      success: true,
      lead: updatedLead,
    };
  }
);

const searchLeadsSchema = z.object({
  teamId: z.number(),
  sourceMode: z.enum(['magnet', 'froid']).default('froid'),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  keywords: z.string().optional(),
});

export const searchColdLeads = validatedActionWithUser(
  searchLeadsSchema,
  async (data, _, user) => {
    const { teamId, sourceMode, ...filters } = data;

    const linkupClient = await getLinkupClient(teamId);
    const result = await linkupClient.searchProfiles(filters);

    const newLeads = [];

    for (const profile of result.profiles) {
      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.linkedinUrl, profile.profile_url),
          eq(leads.teamId, teamId)
        ),
      });

      if (existingLead) continue;

      const [lead] = await db.insert(leads).values({
        teamId,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        linkedinUrl: profile.profile_url,
        profilePictureUrl: profile.profile_picture_url,
        title: profile.headline,
        location: profile.location,
        company: profile.current_company?.name,
        companySize: profile.current_company?.size,
        companyDomain: profile.current_company?.domain,
        industry: profile.current_company?.industry,
        sourceMode,
        status: 'new',
        score: 0,
        profileData: profile,
      }).returning();

      newLeads.push(lead);
    }

    return {
      success: true,
      count: newLeads.length,
      total: result.total,
      leads: newLeads,
    };
  }
);

const updateLeadSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'lost']).optional(),
  score: z.number().optional(),
  scoreReason: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export const updateLead = validatedActionWithUser(
  updateLeadSchema,
  async (data, _, user) => {
    const { leadId, teamId, ...updates } = data;

    const [updatedLead] = await db
      .update(leads)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.teamId, teamId)))
      .returning();

    return {
      success: true,
      lead: updatedLead,
    };
  }
);

export async function getLeadsByTeam(teamId: number, sourceMode?: string) {
  const conditions = [eq(leads.teamId, teamId)];
  
  if (sourceMode) {
    conditions.push(eq(leads.sourceMode, sourceMode));
  }

  return db.query.leads.findMany({
    where: and(...conditions),
    orderBy: [desc(leads.createdAt)],
    limit: 100,
  });
}

export async function getLeadById(leadId: string, teamId: number) {
  return db.query.leads.findFirst({
    where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
  });
}

const updateLeadStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'lost']),
});

export async function updateLeadStatus(formData: FormData) {
  const id = formData.get('id') as string;
  const status = formData.get('status') as 'new' | 'contacted' | 'replied' | 'qualified' | 'lost';

  const [updatedLead] = await db
    .update(leads)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();

  return updatedLead;
}
