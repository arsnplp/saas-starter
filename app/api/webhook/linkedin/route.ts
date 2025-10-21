import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import {
  monitoredCompanies,
  companyPosts,
  leadCollectionConfigs,
  scheduledCollections,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LinkedInWebhookPayload {
  event_type: string;
  platform: string;
  post_id: string;
  post_url: string;
  author_name?: string;
  author_url?: string;
  content?: string;
  media_urls?: string[];
  published_at: string;
  company_url?: string;
  company_id?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔔 Webhook LinkedIn reçu');

    const payload: LinkedInWebhookPayload = await req.json();

    console.log('📦 Payload:', {
      event_type: payload.event_type,
      post_id: payload.post_id,
      post_url: payload.post_url,
      company_url: payload.company_url,
    });

    if (!payload.post_id || !payload.post_url) {
      console.error('❌ Payload invalide: post_id ou post_url manquant');
      return NextResponse.json(
        { error: 'Payload invalide' },
        { status: 400 }
      );
    }

    const companyUrl = payload.company_url || extractCompanyFromPostUrl(payload.post_url);
    
    if (!companyUrl) {
      console.error('❌ Impossible d\'identifier l\'entreprise');
      return NextResponse.json(
        { error: 'Entreprise non identifiée' },
        { status: 400 }
      );
    }

    console.log(`🏢 Entreprise identifiée: ${companyUrl}`);

    const monitoredCompany = await db.query.monitoredCompanies.findFirst({
      where: eq(monitoredCompanies.linkedinCompanyUrl, companyUrl),
      with: {
        collectionConfig: true,
      },
    });

    if (!monitoredCompany) {
      console.log(`⚠️ Entreprise non suivie: ${companyUrl}`);
      return NextResponse.json(
        { message: 'Entreprise non suivie', received: true },
        { status: 200 }
      );
    }

    if (!monitoredCompany.isActive) {
      console.log(`⚠️ Monitoring désactivé pour: ${monitoredCompany.companyName}`);
      return NextResponse.json(
        { message: 'Monitoring désactivé', received: true },
        { status: 200 }
      );
    }

    console.log(`✅ Entreprise suivie: ${monitoredCompany.companyName} (${monitoredCompany.teamId})`);

    const existingPost = await db.query.companyPosts.findFirst({
      where: and(
        eq(companyPosts.postId, payload.post_id),
        eq(companyPosts.teamId, monitoredCompany.teamId)
      ),
    });

    if (existingPost) {
      console.log(`⚠️ Post déjà enregistré: ${payload.post_id}`);
      return NextResponse.json(
        { message: 'Post déjà enregistré', received: true },
        { status: 200 }
      );
    }

    const publishedAt = payload.published_at
      ? new Date(payload.published_at)
      : new Date();

    console.log(`💾 Sauvegarde du post...`);

    const [newPost] = await db
      .insert(companyPosts)
      .values({
        teamId: monitoredCompany.teamId,
        monitoredCompanyId: monitoredCompany.id,
        postId: payload.post_id,
        postUrl: payload.post_url,
        authorName: payload.author_name,
        authorUrl: payload.author_url,
        content: payload.content,
        mediaUrls: payload.media_urls || [],
        publishedAt,
        webhookPayload: payload as any,
        isNew: true,
      })
      .returning();

    console.log(`✅ Post sauvegardé: ${newPost.id}`);

    await db
      .update(monitoredCompanies)
      .set({
        lastPostAt: publishedAt,
        totalPostsReceived: (monitoredCompany.totalPostsReceived || 0) + 1,
      })
      .where(eq(monitoredCompanies.id, monitoredCompany.id));

    console.log(`✅ Entreprise mise à jour`);

    if (monitoredCompany.collectionConfig?.isEnabled) {
      const config = monitoredCompany.collectionConfig;
      const scheduledFor = new Date(
        publishedAt.getTime() + config.delayHours * 60 * 60 * 1000
      );

      console.log(
        `📅 Planification collecte dans ${config.delayHours}h (${scheduledFor.toISOString()})`
      );

      const [collection] = await db
        .insert(scheduledCollections)
        .values({
          teamId: monitoredCompany.teamId,
          postId: newPost.id,
          configId: config.id,
          scheduledFor,
          status: 'pending',
        })
        .returning();

      console.log(`✅ Collecte planifiée: ${collection.id}`);

      return NextResponse.json(
        {
          success: true,
          post: {
            id: newPost.id,
            postId: newPost.postId,
            companyName: monitoredCompany.companyName,
          },
          collection: {
            id: collection.id,
            scheduledFor: collection.scheduledFor,
            delayHours: config.delayHours,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        post: {
          id: newPost.id,
          postId: newPost.postId,
          companyName: monitoredCompany.companyName,
        },
        message: 'Post enregistré sans collecte planifiée',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Erreur webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

function extractCompanyFromPostUrl(postUrl: string): string | null {
  try {
    const patterns = [
      /linkedin\.com\/company\/([^\/\?]+)/,
      /linkedin\.com\/posts\/([^_]+)_/,
      /feed\/update\/urn:li:activity:(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = postUrl.match(pattern);
      if (match) {
        const companySlug = match[1];
        return `linkedin.com/company/${companySlug}`;
      }
    }

    return null;
  } catch (error) {
    console.error('Erreur extraction company:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'LinkedIn Webhook Endpoint',
      endpoint: '/api/webhook/linkedin',
    },
    { status: 200 }
  );
}
