'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { webhookConfigs, webhookEvents } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';

const createWebhookSchema = z.object({
  teamId: z.number(),
  accountId: z.string(),
  accountName: z.string().optional(),
  webhookUrl: z.string().url(),
  isActive: z.boolean().default(true),
});

export const createWebhookConfig = validatedActionWithUser(
  createWebhookSchema,
  async (data, _, user) => {
    const { teamId, accountId, accountName, webhookUrl, isActive } = data;

    const [config] = await db.insert(webhookConfigs).values({
      teamId,
      accountId,
      accountName,
      webhookUrl,
      isActive,
    }).returning();

    return {
      success: true,
      config,
    };
  }
);

const updateWebhookSchema = z.object({
  configId: z.number(),
  teamId: z.number(),
  webhookUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const updateWebhookConfig = validatedActionWithUser(
  updateWebhookSchema,
  async (data, _, user) => {
    const { configId, teamId, ...updates } = data;

    const [updatedConfig] = await db
      .update(webhookConfigs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(webhookConfigs.id, configId), eq(webhookConfigs.teamId, teamId)))
      .returning();

    return {
      success: true,
      config: updatedConfig,
    };
  }
);

const logWebhookEventSchema = z.object({
  teamId: z.number(),
  webhookConfigId: z.number(),
  eventType: z.string(),
  eventData: z.record(z.any()),
});

export const logWebhookEvent = validatedActionWithUser(
  logWebhookEventSchema,
  async (data, _, user) => {
    const { teamId, webhookConfigId, eventType, eventData } = data;

    const [event] = await db.insert(webhookEvents).values({
      teamId,
      webhookConfigId,
      eventType,
      eventData: JSON.stringify(eventData),
      processed: false,
    }).returning();

    return {
      success: true,
      event,
    };
  }
);

const processWebhookEventSchema = z.object({
  eventId: z.number(),
  teamId: z.number(),
});

export const processWebhookEvent = validatedActionWithUser(
  processWebhookEventSchema,
  async (data, _, user) => {
    const { eventId, teamId } = data;

    const [processedEvent] = await db
      .update(webhookEvents)
      .set({
        processed: true,
      })
      .where(and(eq(webhookEvents.id, eventId), eq(webhookEvents.teamId, teamId)))
      .returning();

    return {
      success: true,
      event: processedEvent,
    };
  }
);

export async function getWebhookConfigsByTeam(teamId: number) {
  return db.query.webhookConfigs.findMany({
    where: eq(webhookConfigs.teamId, teamId),
    orderBy: [desc(webhookConfigs.createdAt)],
  });
}

export async function getUnprocessedWebhookEvents(teamId: number) {
  return db.query.webhookEvents.findMany({
    where: and(
      eq(webhookEvents.teamId, teamId),
      eq(webhookEvents.processed, false)
    ),
    orderBy: [desc(webhookEvents.createdAt)],
    limit: 50,
  });
}
