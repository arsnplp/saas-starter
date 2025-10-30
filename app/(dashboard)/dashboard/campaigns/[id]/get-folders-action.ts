'use server';

import { db } from '@/lib/db';
import { prospectFolders, prospectCandidates } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

export async function getFolders() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const folders = await db
    .select({
      id: prospectFolders.id,
      name: prospectFolders.name,
      color: prospectFolders.color,
      icon: prospectFolders.icon,
      prospectCount: sql<number>`COUNT(DISTINCT ${prospectCandidates.id})::int`,
    })
    .from(prospectFolders)
    .leftJoin(
      prospectCandidates,
      eq(prospectCandidates.folderId, prospectFolders.id)
    )
    .where(eq(prospectFolders.teamId, team.id))
    .groupBy(prospectFolders.id);

  return { success: true, folders };
}
