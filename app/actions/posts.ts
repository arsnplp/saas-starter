'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { scheduledPosts, contentBriefs } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';

const createPostSchema = z.object({
  teamId: z.number(),
  userId: z.number(),
  messageText: z.string(),
  postType: z.enum(['profile', 'company']).default('profile'),
  companyUrl: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
});

export const createScheduledPost = validatedActionWithUser(
  createPostSchema,
  async (data, _, user) => {
    const { teamId, userId, messageText, postType, companyUrl, mediaUrls, scheduledAt } = data;

    const [post] = await db.insert(scheduledPosts).values({
      teamId,
      userId,
      messageText,
      postType,
      companyUrl,
      mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
    }).returning();

    return {
      success: true,
      post,
    };
  }
);

const updatePostSchema = z.object({
  postId: z.number(),
  teamId: z.number(),
  messageText: z.string().optional(),
  status: z.enum(['draft', 'approved', 'scheduled', 'published', 'failed']).optional(),
  scheduledAt: z.string().optional(),
  postUrl: z.string().optional(),
});

export const updateScheduledPost = validatedActionWithUser(
  updatePostSchema,
  async (data, _, user) => {
    const { postId, teamId, scheduledAt, ...updates } = data;

    const updateData: any = { ...updates, updatedAt: new Date() };
    if (scheduledAt) {
      updateData.scheduledAt = new Date(scheduledAt);
    }

    const [updatedPost] = await db
      .update(scheduledPosts)
      .set(updateData)
      .where(and(eq(scheduledPosts.id, postId), eq(scheduledPosts.teamId, teamId)))
      .returning();

    return {
      success: true,
      post: updatedPost,
    };
  }
);

const publishPostSchema = z.object({
  postId: z.number(),
  teamId: z.number(),
});

export const publishPost = validatedActionWithUser(
  publishPostSchema,
  async (data, _, user) => {
    const { postId, teamId } = data;

    const post = await db.query.scheduledPosts.findFirst({
      where: and(eq(scheduledPosts.id, postId), eq(scheduledPosts.teamId, teamId)),
    });

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    const [updatedPost] = await db
      .update(scheduledPosts)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId))
      .returning();

    return {
      success: true,
      post: updatedPost,
      message: 'Post published successfully. Note: Actual LinkedIn publishing requires LinkedIn API integration.',
    };
  }
);

const createBriefSchema = z.object({
  teamId: z.number(),
  title: z.string(),
  objectives: z.string().optional(),
  themes: z.string().optional(),
  tone: z.string().optional(),
  cta: z.string().optional(),
  targetAudience: z.string().optional(),
});

export const createContentBrief = validatedActionWithUser(
  createBriefSchema,
  async (data, _, user) => {
    const { teamId, ...briefData } = data;

    const [brief] = await db.insert(contentBriefs).values({
      teamId,
      ...briefData,
    }).returning();

    return {
      success: true,
      brief,
    };
  }
);

export async function getScheduledPostsByTeam(teamId: number, status?: string) {
  const conditions = [eq(scheduledPosts.teamId, teamId)];
  
  if (status) {
    conditions.push(eq(scheduledPosts.status, status));
  }

  return db.query.scheduledPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(scheduledPosts.createdAt)],
    limit: 50,
  });
}

export async function getContentBriefsByTeam(teamId: number) {
  return db.query.contentBriefs.findMany({
    where: eq(contentBriefs.teamId, teamId),
    orderBy: [desc(contentBriefs.createdAt)],
  });
}
