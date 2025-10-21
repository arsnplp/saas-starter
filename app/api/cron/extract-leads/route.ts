import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import {
  scheduledCollections,
  companyPosts,
  leadCollectionConfigs,
  leads,
  monitoredCompanies,
} from '@/lib/db/schema';
import { getPostEngagements } from '@/lib/integrations/apify';
import { and, eq, lte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.INGEST_API_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    
    const pendingCollections = await db
      .select({
        collectionId: scheduledCollections.id,
        teamId: scheduledCollections.teamId,
        postId: scheduledCollections.postId,
        postUrl: companyPosts.postUrl,
        profileId: monitoredCompanies.id,
        profileName: monitoredCompanies.companyName,
        profileType: monitoredCompanies.profileType,
        maxReactions: sql<number>`COALESCE(${scheduledCollections.maxReactionsOverride}, ${leadCollectionConfigs.maxReactions})`.as('max_reactions'),
        maxComments: sql<number>`COALESCE(${scheduledCollections.maxCommentsOverride}, ${leadCollectionConfigs.maxComments})`.as('max_comments'),
      })
      .from(scheduledCollections)
      .innerJoin(companyPosts, eq(companyPosts.id, scheduledCollections.postId))
      .innerJoin(monitoredCompanies, eq(monitoredCompanies.id, companyPosts.monitoredCompanyId))
      .innerJoin(leadCollectionConfigs, eq(leadCollectionConfigs.id, scheduledCollections.configId))
      .where(
        and(
          eq(scheduledCollections.status, 'pending'),
          lte(scheduledCollections.scheduledFor, now)
        )
      )
      .limit(10);

    let totalLeadsCreated = 0;
    let totalReactionsCollected = 0;
    let totalCommentsCollected = 0;
    const errors: string[] = [];

    for (const collection of pendingCollections) {
      try {
        await db
          .update(scheduledCollections)
          .set({ status: 'processing' })
          .where(eq(scheduledCollections.id, collection.collectionId));

        const engagements = await getPostEngagements(collection.postUrl, {
          includeReactions: collection.maxReactions > 0,
          includeComments: collection.maxComments > 0,
        });

        let reactionsCount = 0;
        let commentsCount = 0;
        let leadsCreated = 0;

        for (const engagement of engagements) {
          if (!engagement.profileUrl) continue;

          if (engagement.type === 'reaction' && reactionsCount >= collection.maxReactions) {
            continue;
          }
          if (engagement.type === 'comment' && commentsCount >= collection.maxComments) {
            continue;
          }

          const existing = await db
            .select()
            .from(leads)
            .where(
              and(
                eq(leads.teamId, collection.teamId),
                eq(leads.linkedinUrl, engagement.profileUrl)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            const nameParts = engagement.profileName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            await db.insert(leads).values({
              teamId: collection.teamId,
              linkedinUrl: engagement.profileUrl,
              firstName,
              lastName,
              company: engagement.profileCompany || null,
              title: engagement.profileTitle || null,
              profilePictureUrl: engagement.profilePictureUrl || null,
              sourceMode: 'monitoring',
              sourcePostUrl: collection.postUrl,
              engagementType: engagement.type,
              reactionType: engagement.reactionType || null,
              commentText: engagement.commentText || null,
              detectedPostId: collection.postId,
              status: 'new',
              score: 0,
            });

            leadsCreated++;
          }

          if (engagement.type === 'reaction') {
            reactionsCount++;
          } else {
            commentsCount++;
          }
        }

        await db
          .update(scheduledCollections)
          .set({
            status: 'completed',
            collectedAt: new Date(),
            reactionsCollected: reactionsCount,
            commentsCollected: commentsCount,
            leadsCreated: leadsCreated,
            creditsUsed: Math.ceil((reactionsCount + commentsCount) / 100),
          })
          .where(eq(scheduledCollections.id, collection.collectionId));

        await db
          .update(companyPosts)
          .set({ isNew: false })
          .where(eq(companyPosts.id, collection.postId));

        totalLeadsCreated += leadsCreated;
        totalReactionsCollected += reactionsCount;
        totalCommentsCollected += commentsCount;

      } catch (error) {
        const errorMessage = `Erreur pour post ${collection.postUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);

        await db
          .update(scheduledCollections)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(scheduledCollections.id, collection.collectionId));
      }
    }

    return NextResponse.json({
      success: true,
      collectionsProcessed: pendingCollections.length,
      leadsCreated: totalLeadsCreated,
      reactionsCollected: totalReactionsCollected,
      commentsCollected: totalCommentsCollected,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error in extract-leads cron:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
