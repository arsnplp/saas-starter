'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { icpProfiles } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const icpSchema = z.object({
  teamId: z.number(),
  name: z.string().min(1, 'Le nom est requis'),
  industries: z.string().optional(),
  locations: z.string().optional(),
  buyerRoles: z.string().optional(),
  keywordsInclude: z.string().optional(),
  keywordsExclude: z.string().optional(),
  companySizeMin: z.number().min(1).default(1),
  companySizeMax: z.number().min(1).default(10000),
  productCategory: z.string().optional(),
  language: z.string().default('fr'),
  minScore: z.number().min(0).max(100).default(50),
});

export const saveIcpProfile = validatedActionWithUser(
  icpSchema,
  async (data, _, user) => {
    const { teamId, ...icpData } = data;

    // Check if ICP already exists for this team
    const existing = await db.query.icpProfiles.findFirst({
      where: eq(icpProfiles.teamId, teamId),
    });

    if (existing) {
      // Update existing ICP
      await db
        .update(icpProfiles)
        .set({
          ...icpData,
          updatedAt: new Date(),
        })
        .where(eq(icpProfiles.id, existing.id));
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
  });
}
