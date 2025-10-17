'use server';

import { db } from '@/lib/db/drizzle';
import { linkedinPosts, linkedinPostSettings } from '@/lib/db/schema';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updatePostSettings(postsPerWeek: number, autoValidationMode: boolean) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe introuvable' };
  }

  try {
    const existing = await db.query.linkedinPostSettings.findFirst({
      where: eq(linkedinPostSettings.teamId, team.id),
    });

    if (existing) {
      await db
        .update(linkedinPostSettings)
        .set({
          postsPerWeek,
          autoValidationMode,
          updatedAt: new Date(),
        })
        .where(eq(linkedinPostSettings.teamId, team.id));
    } else {
      await db.insert(linkedinPostSettings).values({
        teamId: team.id,
        postsPerWeek,
        autoValidationMode,
      });
    }

    revalidatePath('/dashboard/posts');
    return { success: true };
  } catch (error) {
    console.error('Error updating post settings:', error);
    return { success: false, error: 'Erreur lors de la mise à jour' };
  }
}

export async function generateWeeklySlots() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe introuvable' };
  }

  try {
    const settings = await db.query.linkedinPostSettings.findFirst({
      where: eq(linkedinPostSettings.teamId, team.id),
    });

    if (!settings) {
      return { success: false, error: 'Veuillez configurer les paramètres d\'abord' };
    }

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    startOfWeek.setHours(9, 0, 0, 0);

    const slots = [];
    const daysInterval = Math.floor(7 / settings.postsPerWeek);

    for (let i = 0; i < settings.postsPerWeek; i++) {
      const scheduledDate = new Date(startOfWeek);
      scheduledDate.setDate(startOfWeek.getDate() + (i * daysInterval));
      
      slots.push({
        teamId: team.id,
        type: 'classique',
        status: 'draft',
        scheduledFor: scheduledDate,
        createdBy: user.id,
      });
    }

    await db.insert(linkedinPosts).values(slots);

    revalidatePath('/dashboard/posts');
    return { success: true, slotsCreated: slots.length };
  } catch (error) {
    console.error('Error generating weekly slots:', error);
    return { success: false, error: 'Erreur lors de la génération des slots' };
  }
}

export async function updatePost(
  postId: number,
  data: {
    type?: string;
    userContext?: string;
    finalContent?: string;
    imageUrl?: string;
  }
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe introuvable' };
  }

  try {
    const post = await db.query.linkedinPosts.findFirst({
      where: eq(linkedinPosts.id, postId),
    });

    if (!post || post.teamId !== team.id) {
      return { success: false, error: 'Post introuvable' };
    }

    await db
      .update(linkedinPosts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(linkedinPosts.id, postId));

    revalidatePath('/dashboard/posts');
    revalidatePath(`/dashboard/posts/${postId}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating post:', error);
    return { success: false, error: 'Erreur lors de la mise à jour' };
  }
}

export async function validatePost(postId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe introuvable' };
  }

  try {
    const post = await db.query.linkedinPosts.findFirst({
      where: eq(linkedinPosts.id, postId),
    });

    if (!post || post.teamId !== team.id) {
      return { success: false, error: 'Post introuvable' };
    }

    await db
      .update(linkedinPosts)
      .set({
        status: 'scheduled',
        validatedBy: user.id,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(linkedinPosts.id, postId));

    revalidatePath('/dashboard/posts');
    revalidatePath(`/dashboard/posts/${postId}`);
    return { success: true };
  } catch (error) {
    console.error('Error validating post:', error);
    return { success: false, error: 'Erreur lors de la validation' };
  }
}

export async function deletePost(postId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe introuvable' };
  }

  try {
    const post = await db.query.linkedinPosts.findFirst({
      where: eq(linkedinPosts.id, postId),
    });

    if (!post || post.teamId !== team.id) {
      return { success: false, error: 'Post introuvable' };
    }

    if (post.status === 'published') {
      return { success: false, error: 'Impossible de supprimer un post publié' };
    }

    await db.delete(linkedinPosts).where(eq(linkedinPosts.id, postId));

    revalidatePath('/dashboard/posts');
    return { success: true };
  } catch (error) {
    console.error('Error deleting post:', error);
    return { success: false, error: 'Erreur lors de la suppression' };
  }
}
