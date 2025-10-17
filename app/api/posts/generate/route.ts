import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateLinkedInPost } from '@/lib/services/linkedin-post-generator';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ success: false, error: 'Équipe introuvable' }, { status: 404 });
    }

    const { postId, type, userContext } = await req.json();

    if (!postId || !type || !userContext) {
      return NextResponse.json(
        { success: false, error: 'Données manquantes' },
        { status: 400 }
      );
    }

    const post = await db.query.linkedinPosts.findFirst({
      where: eq(linkedinPosts.id, postId),
    });

    if (!post || post.teamId !== team.id) {
      return NextResponse.json({ success: false, error: 'Post introuvable' }, { status: 404 });
    }

    const generatedContent = await generateLinkedInPost({
      type,
      userContext,
      companyName: team.name,
      targetAudience: 'vos prospects B2B',
      expertise: 'lead generation et prospection LinkedIn',
    });

    await db
      .update(linkedinPosts)
      .set({
        userContext,
        generatedContent,
        finalContent: generatedContent,
        status: 'generated',
        updatedAt: new Date(),
      })
      .where(eq(linkedinPosts.id, postId));

    return NextResponse.json({
      success: true,
      content: generatedContent,
    });
  } catch (error: any) {
    console.error('Error generating post:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la génération' },
      { status: 500 }
    );
  }
}
