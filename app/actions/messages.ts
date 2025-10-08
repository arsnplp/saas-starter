'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { leads, messages } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';

const generateMessageSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
  messageType: z.enum(['connection', 'follow_up', 'value_proposition', 'custom']),
  customPrompt: z.string().optional(),
  companyInfo: z.object({
    name: z.string(),
    value: z.string(),
    cta: z.string(),
  }).optional(),
});

export const generateMessage = validatedActionWithUser(
  generateMessageSchema,
  async (data, _, user) => {
    const { leadId, teamId, messageType, customPrompt, companyInfo } = data;

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
    });

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    let messageContent = '';

    switch (messageType) {
      case 'connection':
        messageContent = `Hi ${lead.firstName || 'there'},

I came across your profile and noticed you're ${lead.title || 'in the industry'}${lead.company ? ` at ${lead.company}` : ''}. ${
          lead.engagementType === 'comment'
            ? `I saw your thoughtful comment on the post about ${lead.sourcePostUrl?.split('/').pop()}.`
            : lead.engagementType === 'reaction'
            ? `I noticed you engaged with a post I found interesting.`
            : ''
        }

${companyInfo ? `At ${companyInfo.name}, we ${companyInfo.value}.` : ''}

I would love to connect and share insights about the industry.

Best regards`;
        break;

      case 'follow_up':
        messageContent = `Hi ${lead.firstName || 'there'},

Thanks for connecting! I wanted to follow up on our mutual interest in ${lead.industry || 'the industry'}.

${companyInfo ? `I thought you might find value in what we're doing at ${companyInfo.name}. ${companyInfo.value}` : ''}

${companyInfo?.cta || 'Would you be open to a quick chat?'}

Looking forward to hearing from you!`;
        break;

      case 'value_proposition':
        messageContent = `Hi ${lead.firstName || 'there'},

I hope this message finds you well. As ${lead.title || 'someone in your position'}${lead.company ? ` at ${lead.company}` : ''}, you might be interested in how we help companies like yours.

${companyInfo ? `${companyInfo.value}\n\n${companyInfo.cta}` : 'I would love to share how we can add value to your team.'}

Would you be open to a brief conversation?

Best regards`;
        break;

      case 'custom':
        if (!customPrompt) {
          return { success: false, error: 'Custom prompt required for custom messages' };
        }
        messageContent = customPrompt
          .replace(/\{firstName\}/g, lead.firstName || '')
          .replace(/\{lastName\}/g, lead.lastName || '')
          .replace(/\{title\}/g, lead.title || '')
          .replace(/\{company\}/g, lead.company || '')
          .replace(/\{location\}/g, lead.location || '');
        break;
    }

    const [newMessage] = await db.insert(messages).values({
      teamId,
      leadId,
      messageText: messageContent,
      status: 'draft',
    }).returning();

    return {
      success: true,
      message: newMessage,
    };
  }
);

const updateMessageSchema = z.object({
  messageId: z.number(),
  teamId: z.number(),
  messageText: z.string().optional(),
  status: z.enum(['draft', 'approved', 'sent', 'delivered', 'failed']).optional(),
});

export const updateMessage = validatedActionWithUser(
  updateMessageSchema,
  async (data, _, user) => {
    const { messageId, teamId, ...updates } = data;

    const [updatedMessage] = await db
      .update(messages)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(messages.id, messageId), eq(messages.teamId, teamId)))
      .returning();

    return {
      success: true,
      message: updatedMessage,
    };
  }
);

const sendMessageSchema = z.object({
  messageId: z.number(),
  teamId: z.number(),
});

export const sendMessage = validatedActionWithUser(
  sendMessageSchema,
  async (data, _, user) => {
    const { messageId, teamId } = data;

    const message = await db.query.messages.findFirst({
      where: and(eq(messages.id, messageId), eq(messages.teamId, teamId)),
    });

    if (!message) {
      return { success: false, error: 'Message not found' };
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    await db
      .update(leads)
      .set({
        status: 'contacted',
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, message.leadId));

    return {
      success: true,
      message: updatedMessage,
    };
  }
);

export async function getMessagesByLead(leadId: string, teamId: number) {
  return db.query.messages.findMany({
    where: and(eq(messages.leadId, leadId), eq(messages.teamId, teamId)),
    orderBy: [desc(messages.createdAt)],
  });
}

export async function getMessagesByTeam(teamId: number) {
  return db.query.messages.findMany({
    where: eq(messages.teamId, teamId),
    orderBy: [desc(messages.createdAt)],
    limit: 50,
  });
}
