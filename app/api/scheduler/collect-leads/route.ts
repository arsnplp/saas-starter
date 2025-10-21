import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scheduledCollections, companyPosts } from '@/lib/db/schema';
import { and, lte, eq } from 'drizzle-orm';
import { PostCollector } from '@/lib/services/post-collector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.INGEST_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    console.log('⏰ === SCHEDULER: COLLECTE LEADS ===');

    const now = new Date();
    console.log(`📅 ${now.toISOString()}`);

    const pendingCollections = await db.query.scheduledCollections.findMany({
      where: and(
        eq(scheduledCollections.status, 'pending'),
        lte(scheduledCollections.scheduledFor, now)
      ),
      with: {
        post: {
          with: {
            monitoredCompany: true,
          },
        },
        config: true,
      },
      limit: 50,
    });

    console.log(`📊 ${pendingCollections.length} collectes planifiées`);

    if (pendingCollections.length === 0) {
      return NextResponse.json({
        message: 'Aucune collecte planifiée',
        timestamp: now.toISOString(),
      });
    }

    const results = [];

    for (const collection of pendingCollections) {
      try {
        console.log(`\n🎯 Collecte: ${collection.id}`);
        console.log(`Post: ${collection.post.postUrl}`);
        console.log(`Entreprise: ${collection.post.monitoredCompany.companyName}`);
        console.log(`Planifié pour: ${collection.scheduledFor.toISOString()}`);

        await db
          .update(scheduledCollections)
          .set({ status: 'processing' })
          .where(eq(scheduledCollections.id, collection.id));

        const result = await PostCollector.collectPostLeads(
          collection.postId,
          collection.teamId
        );

        results.push({
          collectionId: collection.id,
          postId: collection.postId,
          teamId: collection.teamId,
          companyName: collection.post.monitoredCompany.companyName,
          success: !result.error,
          ...result,
        });

        console.log(`✅ Collecte terminée pour ${collection.id}`);
      } catch (error: any) {
        console.error(`❌ Erreur collecte ${collection.id}:`, error);

        await db
          .update(scheduledCollections)
          .set({
            status: 'failed',
            errorMessage: error.message,
          })
          .where(eq(scheduledCollections.id, collection.id));

        results.push({
          collectionId: collection.id,
          postId: collection.postId,
          teamId: collection.teamId,
          success: false,
          error: error.message,
          reactionsCollected: 0,
          commentsCollected: 0,
          leadsCreated: 0,
          creditsUsed: 0,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalLeads = results.reduce((sum, r) => sum + (r.leadsCreated || 0), 0);
    const totalCredits = results.reduce((sum, r) => sum + (r.creditsUsed || 0), 0);

    console.log(`\n✅ === RÉSULTAT ===`);
    console.log(`Collectes réussies: ${successCount}`);
    console.log(`Collectes échouées: ${failureCount}`);
    console.log(`Leads créés: ${totalLeads}`);
    console.log(`Crédits utilisés: ${totalCredits}`);

    return NextResponse.json({
      message: 'Collecte de leads terminée',
      timestamp: now.toISOString(),
      totalCollections: pendingCollections.length,
      success: successCount,
      failures: failureCount,
      totalLeads,
      totalCredits,
      results,
    });
  } catch (error: any) {
    console.error('❌ Erreur scheduler:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const now = new Date();
  
  const upcomingCollections = await db.query.scheduledCollections.findMany({
    where: and(
      eq(scheduledCollections.status, 'pending'),
      lte(scheduledCollections.scheduledFor, new Date(now.getTime() + 24 * 60 * 60 * 1000))
    ),
    with: {
      post: {
        with: {
          monitoredCompany: true,
        },
      },
    },
    limit: 20,
  });

  return NextResponse.json({
    status: 'ok',
    scheduler: 'collect-leads',
    description: 'Collecte les leads des posts planifiés',
    schedule: 'Toutes les heures',
    upcomingCollections: upcomingCollections.map((c) => ({
      id: c.id,
      companyName: c.post.monitoredCompany.companyName,
      postUrl: c.post.postUrl,
      scheduledFor: c.scheduledFor,
    })),
  });
}
