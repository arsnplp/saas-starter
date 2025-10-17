import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { LinkedInPublisher } from '@/lib/services/linkedin-publisher';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ success: false, error: 'Équipe introuvable' }, { status: 404 });
    }

    const postId = parseInt(params.id);
    const post = await db.query.linkedinPosts.findFirst({
      where: eq(linkedinPosts.id, postId),
    });

    if (!post || post.teamId !== team.id) {
      return NextResponse.json({ success: false, error: 'Post introuvable' }, { status: 404 });
    }

    if (post.status === 'published') {
      return NextResponse.json({ success: false, error: 'Ce post est déjà publié' }, { status: 400 });
    }

    const content = post.finalContent || post.generatedContent;
    if (!content) {
      return NextResponse.json({ success: false, error: 'Le post n\'a pas de contenu' }, { status: 400 });
    }

    const publishResult = await LinkedInPublisher.publishPost({
      teamId: team.id,
      content,
      imageUrl: post.imageUrl || undefined,
    });

    if (publishResult.success) {
      await db
        .update(linkedinPosts)
        .set({
          status: 'published',
          publishedAt: new Date(),
          linkedinPostId: publishResult.postId,
          validatedBy: user.id,
          validatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(linkedinPosts.id, postId));

      return NextResponse.json({
        success: true,
        linkedinPostId: publishResult.postId,
        message: 'Post publié avec succès sur LinkedIn !',
      });
    } else {
      await db
        .update(linkedinPosts)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(linkedinPosts.id, postId));

      return NextResponse.json(
        { success: false, error: publishResult.error || 'Échec de la publication' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error publishing post:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la publication' },
      { status: 500 }
    );
  }
}
