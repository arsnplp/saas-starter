import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { monitoredCompanies, companyPosts, leadCollectionConfigs, scheduledCollections } from '@/lib/db/schema';
import { getProfilePosts } from '@/lib/integrations/apify';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.INGEST_API_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeProfiles = await db
      .select({
        id: monitoredCompanies.id,
        teamId: monitoredCompanies.teamId,
        linkedinUrl: monitoredCompanies.linkedinCompanyUrl,
        profileName: monitoredCompanies.companyName,
        profileType: monitoredCompanies.profileType,
        lastPostAt: monitoredCompanies.lastPostAt,
        totalPostsReceived: monitoredCompanies.totalPostsReceived,
        configId: leadCollectionConfigs.id,
        delayHours: leadCollectionConfigs.delayHours,
      })
      .from(monitoredCompanies)
      .leftJoin(
        leadCollectionConfigs,
        eq(leadCollectionConfigs.monitoredCompanyId, monitoredCompanies.id)
      )
      .where(
        and(
          eq(monitoredCompanies.isActive, true),
          eq(leadCollectionConfigs.isEnabled, true)
        )
      );

    let totalPostsDetected = 0;
    let totalScheduled = 0;
    const errors: string[] = [];

    for (const profile of activeProfiles) {
      try {
        const posts = await getProfilePosts(profile.linkedinUrl, 1, true);
        
        for (const post of posts) {
          const existing = await db
            .select()
            .from(companyPosts)
            .where(
              and(
                eq(companyPosts.teamId, profile.teamId),
                eq(companyPosts.postUrl, post.postUrl)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            const [newPost] = await db
              .insert(companyPosts)
              .values({
                teamId: profile.teamId,
                monitoredCompanyId: profile.id,
                postId: post.postId,
                postUrl: post.postUrl,
                authorName: post.authorName,
                authorUrl: post.authorUrl,
                content: post.content,
                postType: post.postType || 'regular',
                mediaUrls: post.mediaUrls || [],
                publishedAt: new Date(post.publishedAt),
                isNew: true,
                webhookPayload: post,
              })
              .returning();

            totalPostsDetected++;

            const scheduledFor = new Date();
            scheduledFor.setHours(scheduledFor.getHours() + (profile.delayHours || 24));

            await db.insert(scheduledCollections).values({
              teamId: profile.teamId,
              postId: newPost.id,
              configId: profile.configId!,
              scheduledFor,
              status: 'pending',
            });

            totalScheduled++;

            await db
              .update(monitoredCompanies)
              .set({
                lastPostAt: new Date(post.publishedAt),
                totalPostsReceived: (profile.totalPostsReceived || 0) + 1,
              })
              .where(eq(monitoredCompanies.id, profile.id));
          }
        }

        await db
          .update(monitoredCompanies)
          .set({ lastCheckedAt: new Date() })
          .where(eq(monitoredCompanies.id, profile.id));

      } catch (error) {
        const errorMessage = `Erreur pour ${profile.profileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    return NextResponse.json({
      success: true,
      profilesChecked: activeProfiles.length,
      postsDetected: totalPostsDetected,
      collectionsScheduled: totalScheduled,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error in detect-posts cron:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
