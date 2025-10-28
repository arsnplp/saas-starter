'use server';

import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { generateApiKey } from '@/lib/api-keys';
import { revalidatePath } from 'next/cache';

export async function getApiKey() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.teamId, team.id),
      eq(apiKeys.isActive, true)
    ),
  });

  if (!apiKey) {
    return { success: true, exists: false };
  }

  return {
    success: true,
    exists: true,
    apiKey: {
      id: apiKey.id,
      preview: apiKey.keyPreview,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    },
  };
}

export async function createApiKey() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const existingKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.teamId, team.id),
  });

  if (existingKey) {
    return { success: false, error: 'Une clé API existe déjà. Régénérez-la si nécessaire.' };
  }

  const { key, hash, preview } = generateApiKey();

  await db.insert(apiKeys).values({
    teamId: team.id,
    keyHash: hash,
    keyPreview: preview,
    isActive: true,
  });

  revalidatePath('/dashboard/integrations');

  return {
    success: true,
    key,
  };
}

export async function regenerateApiKey() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  await db
    .delete(apiKeys)
    .where(eq(apiKeys.teamId, team.id));

  const { key, hash, preview } = generateApiKey();

  await db.insert(apiKeys).values({
    teamId: team.id,
    keyHash: hash,
    keyPreview: preview,
    isActive: true,
  });

  revalidatePath('/dashboard/integrations');

  return {
    success: true,
    key,
  };
}

export async function deleteApiKey() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  await db
    .delete(apiKeys)
    .where(eq(apiKeys.teamId, team.id));

  revalidatePath('/dashboard/integrations');

  return { success: true };
}
