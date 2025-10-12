'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { icpProfiles } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const icpSchema = z.object({
  teamId: z.coerce.number(),
  icpId: z.coerce.number().optional(),
  name: z.string().min(1, 'Le nom est requis'),
  industries: z.string().optional(),
  locations: z.string().optional(),
  buyerRoles: z.string().optional(),
  keywordsInclude: z.string().optional(),
  keywordsExclude: z.string().optional(),
  companySizeMin: z.coerce.number().min(1).default(1),
  companySizeMax: z.coerce.number().min(1).default(10000),
  productCategory: z.string().optional(),
  language: z.string().default('fr'),
  minScore: z.coerce.number().min(0).max(100).default(50),
});

export const saveIcpProfile = validatedActionWithUser(
  icpSchema,
  async (data, formData, user) => {
    const { teamId, icpId, ...icpData } = data;

    if (icpId) {
      // Update existing ICP
      const existing = await db.query.icpProfiles.findFirst({
        where: and(
          eq(icpProfiles.teamId, teamId),
          eq(icpProfiles.id, icpId)
        ),
      });

      if (!existing) {
        return { success: false, error: 'ICP introuvable' };
      }

      await db
        .update(icpProfiles)
        .set({
          ...icpData,
          updatedAt: new Date(),
        })
        .where(eq(icpProfiles.id, icpId));
    } else {
      // Create new ICP
      await db.insert(icpProfiles).values({
        teamId,
        ...icpData,
      });
    }

    revalidatePath('/dashboard/icp');
    return { success: true };
  }
);

export async function getIcpProfile(teamId: number) {
  return await db.query.icpProfiles.findFirst({
    where: eq(icpProfiles.teamId, teamId),
    orderBy: (icpProfiles, { desc }) => [desc(icpProfiles.createdAt)],
  });
}

export async function getAllIcpProfiles(teamId: number) {
  return await db.query.icpProfiles.findMany({
    where: eq(icpProfiles.teamId, teamId),
    orderBy: (icpProfiles, { desc }) => [desc(icpProfiles.createdAt)],
  });
}

export async function getIcpProfileById(teamId: number, icpId: number) {
  return await db.query.icpProfiles.findFirst({
    where: and(
      eq(icpProfiles.teamId, teamId),
      eq(icpProfiles.id, icpId)
    ),
  });
}
