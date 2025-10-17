import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const { teamId, userId, scheduledFor } = await req.json();

    if (!teamId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Données manquantes' },
        { status: 400 }
      );
    }

    const [newPost] = await db
      .insert(linkedinPosts)
      .values({
        teamId,
        type: 'classique',
        status: 'draft',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdBy: userId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      postId: newPost.id,
    });
  } catch (error: any) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
