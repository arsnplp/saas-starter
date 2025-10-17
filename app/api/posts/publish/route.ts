import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts } from '@/lib/db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { LinkedInPublisher } from '@/lib/services/linkedin-publisher';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiToken = process.env.INGEST_API_TOKEN;

    if (!apiToken || authHeader !== `Bearer ${apiToken}`) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const now = new Date();

    const postsToPublish = await db.query.linkedinPosts.findMany({
      where: and(
        eq(linkedinPosts.status, 'scheduled'),
        lte(linkedinPosts.scheduledFor, now)
      ),
    });

    const results = [];

    for (const post of postsToPublish) {
      try {
        const content = post.finalContent || post.generatedContent;

        if (!content) {
          await db
            .update(linkedinPosts)
            .set({ 
              status: 'failed',
              updatedAt: new Date() 
            })
            .where(eq(linkedinPosts.id, post.id));
          
          results.push({
            postId: post.id,
            success: false,
            error: 'Pas de contenu à publier',
          });
          continue;
        }

        const publishResult = await LinkedInPublisher.publishPost({
          teamId: post.teamId,
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
              updatedAt: new Date(),
            })
            .where(eq(linkedinPosts.id, post.id));

          results.push({
            postId: post.id,
            success: true,
            linkedinPostId: publishResult.postId,
          });
        } else {
          await db
            .update(linkedinPosts)
            .set({
              status: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(linkedinPosts.id, post.id));

          results.push({
            postId: post.id,
            success: false,
            error: publishResult.error,
          });
        }
      } catch (error: any) {
        console.error(`Error publishing post ${post.id}:`, error);
        
        await db
          .update(linkedinPosts)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(linkedinPosts.id, post.id));

        results.push({
          postId: post.id,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error in publish scheduler:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors du scheduling' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiToken = process.env.INGEST_API_TOKEN;

    if (!apiToken || authHeader !== `Bearer ${apiToken}`) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const now = new Date();

    const postsToPublish = await db.query.linkedinPosts.findMany({
      where: and(
        eq(linkedinPosts.status, 'scheduled'),
        lte(linkedinPosts.scheduledFor, now)
      ),
    });

    return NextResponse.json({
      success: true,
      count: postsToPublish.length,
      posts: postsToPublish.map(p => ({
        id: p.id,
        teamId: p.teamId,
        type: p.type,
        scheduledFor: p.scheduledFor,
      })),
    });
  } catch (error: any) {
    console.error('Error checking scheduled posts:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
