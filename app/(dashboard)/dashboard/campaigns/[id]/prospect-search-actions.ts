'use server';

import { db } from '@/lib/db';
import { prospectCandidates } from '@/lib/db/schema';
import { ilike, or, and, eq } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

export async function searchProspects(query: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const searchTerm = `%${query}%`;

  const prospects = await db
    .select({
      id: prospectCandidates.id,
      name: prospectCandidates.name,
      title: prospectCandidates.title,
      company: prospectCandidates.company,
      email: prospectCandidates.email,
      location: prospectCandidates.location,
    })
    .from(prospectCandidates)
    .where(
      and(
        eq(prospectCandidates.teamId, team.id),
        or(
          ilike(prospectCandidates.name, searchTerm),
          ilike(prospectCandidates.company, searchTerm),
          ilike(prospectCandidates.email, searchTerm)
        )
      )
    )
    .limit(20);

  return { success: true, prospects };
}
