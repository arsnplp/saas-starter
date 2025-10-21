import { db } from '@/lib/db/drizzle';
import {
  companyPosts,
  prospectCandidates,
  scheduledCollections,
  leadCollectionConfigs,
  monitoredCompanies,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const LINKUP_API_BASE = process.env.LINKUP_API_BASE || 'https://api.linkupapi.com';
const LINKUP_API_KEY = process.env.LINKUP_API_KEY;

interface CollectionResult {
  reactionsCollected: number;
  commentsCollected: number;
  leadsCreated: number;
  creditsUsed: number;
  error?: string;
}

interface Reaction {
  actor_urn: string;
  profile_url: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  reaction_type: string;
}

interface Comment {
  comment_id: string;
  actor_urn: string;
  profile_url: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  comment_text: string;
}

export class PostCollector {
  private static async callLinkUpAPI<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    if (!LINKUP_API_KEY) {
      throw new Error('LINKUP_API_KEY non configurée');
    }

    const url = `${LINKUP_API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LINKUP_API_KEY,
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    console.log(`[PostCollector] ${method} ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkUp API ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  static async collectPostLeads(
    postId: string,
    teamId: number
  ): Promise<CollectionResult> {
    console.log(`🎯 === COLLECTE LEADS POST ===`);
    console.log(`Post ID: ${postId}`);
    console.log(`Team ID: ${teamId}`);

    const post = await db.query.companyPosts.findFirst({
      where: and(
        eq(companyPosts.id, postId),
        eq(companyPosts.teamId, teamId)
      ),
      with: {
        monitoredCompany: {
          with: {
            collectionConfig: true,
          },
        },
      },
    });

    if (!post) {
      throw new Error(`Post non trouvé: ${postId}`);
    }

    const collection = await db.query.scheduledCollections.findFirst({
      where: eq(scheduledCollections.postId, postId),
      with: {
        config: true,
      },
    });

    if (!collection || !collection.config) {
      throw new Error(`Configuration de collecte non trouvée pour le post ${postId}`);
    }

    const config = collection.config;

    console.log(`📊 Configuration:`);
    console.log(`  - Max réactions: ${config.maxReactions}`);
    console.log(`  - Max commentaires: ${config.maxComments}`);
    console.log(`  - Post URL: ${post.postUrl}`);

    const result: CollectionResult = {
      reactionsCollected: 0,
      commentsCollected: 0,
      leadsCreated: 0,
      creditsUsed: 0,
    };

    try {
      if (config.maxReactions > 0) {
        console.log(`\n🎯 === COLLECTE RÉACTIONS ===`);
        const reactionsResult = await this.collectReactions(
          post.postUrl,
          config.maxReactions,
          teamId,
          post.monitoredCompany.companyName
        );
        result.reactionsCollected = reactionsResult.count;
        result.leadsCreated += reactionsResult.count;
        result.creditsUsed += reactionsResult.creditsUsed;
      }

      if (config.maxComments > 0) {
        console.log(`\n💬 === COLLECTE COMMENTAIRES ===`);
        const commentsResult = await this.collectComments(
          post.postUrl,
          config.maxComments,
          teamId,
          post.monitoredCompany.companyName
        );
        result.commentsCollected = commentsResult.count;
        result.leadsCreated += commentsResult.count;
        result.creditsUsed += commentsResult.creditsUsed;
      }

      await db
        .update(scheduledCollections)
        .set({
          status: 'completed',
          collectedAt: new Date(),
          reactionsCollected: result.reactionsCollected,
          commentsCollected: result.commentsCollected,
          leadsCreated: result.leadsCreated,
          creditsUsed: result.creditsUsed,
        })
        .where(eq(scheduledCollections.id, collection.id));

      console.log(`\n✅ === COLLECTE TERMINÉE ===`);
      console.log(`Réactions: ${result.reactionsCollected}`);
      console.log(`Commentaires: ${result.commentsCollected}`);
      console.log(`Leads créés: ${result.leadsCreated}`);
      console.log(`Crédits utilisés: ${result.creditsUsed}`);

      return result;
    } catch (error: any) {
      console.error(`❌ Erreur collecte:`, error);

      await db
        .update(scheduledCollections)
        .set({
          status: 'failed',
          errorMessage: error.message,
        })
        .where(eq(scheduledCollections.id, collection.id));

      result.error = error.message;
      return result;
    }
  }

  private static async collectReactions(
    postUrl: string,
    maxReactions: number,
    teamId: number,
    companyName: string
  ): Promise<{ count: number; creditsUsed: number }> {
    try {
      const response = await this.callLinkUpAPI<{
        reactions: Reaction[];
        credits_used: number;
      }>('/v1/linkedin/post/reactions', 'POST', {
        post_url: postUrl,
        max_results: maxReactions,
      });

      const reactions = response.reactions || [];
      console.log(`✅ ${reactions.length} réactions récupérées`);

      let inserted = 0;

      for (const reaction of reactions) {
        try {
          await db
            .insert(prospectCandidates)
            .values({
              teamId,
              source: 'real_time_monitoring',
              sourceRef: `${companyName} • Post: ${postUrl}`,
              action: 'reaction',
              postUrl,
              reactionType: reaction.reaction_type,
              profileUrl: reaction.profile_url,
              actorUrn: reaction.actor_urn,
              name: reaction.name,
              title: reaction.title,
              company: reaction.company,
              location: reaction.location,
              status: 'new',
              raw: reaction as any,
            })
            .onConflictDoNothing();

          inserted++;
        } catch (error) {
          console.error(`⚠️ Erreur insertion réaction:`, error);
        }
      }

      console.log(`💾 ${inserted} réactions sauvegardées`);

      return {
        count: inserted,
        creditsUsed: response.credits_used || 0,
      };
    } catch (error: any) {
      console.error(`❌ Erreur collecte réactions:`, error);
      return { count: 0, creditsUsed: 0 };
    }
  }

  private static async collectComments(
    postUrl: string,
    maxComments: number,
    teamId: number,
    companyName: string
  ): Promise<{ count: number; creditsUsed: number }> {
    try {
      const response = await this.callLinkUpAPI<{
        comments: Comment[];
        credits_used: number;
      }>('/v1/linkedin/post/comments', 'POST', {
        post_url: postUrl,
        max_results: maxComments,
      });

      const comments = response.comments || [];
      console.log(`✅ ${comments.length} commentaires récupérés`);

      let inserted = 0;

      for (const comment of comments) {
        try {
          await db
            .insert(prospectCandidates)
            .values({
              teamId,
              source: 'real_time_monitoring',
              sourceRef: `${companyName} • Post: ${postUrl}`,
              action: 'comment',
              postUrl,
              commentId: comment.comment_id,
              commentText: comment.comment_text,
              profileUrl: comment.profile_url,
              actorUrn: comment.actor_urn,
              name: comment.name,
              title: comment.title,
              company: comment.company,
              location: comment.location,
              status: 'new',
              raw: comment as any,
            })
            .onConflictDoNothing();

          inserted++;
        } catch (error) {
          console.error(`⚠️ Erreur insertion commentaire:`, error);
        }
      }

      console.log(`💾 ${inserted} commentaires sauvegardés`);

      return {
        count: inserted,
        creditsUsed: response.credits_used || 0,
      };
    } catch (error: any) {
      console.error(`❌ Erreur collecte commentaires:`, error);
      return { count: 0, creditsUsed: 0 };
    }
  }

  static estimateCredits(config: {
    maxReactions: number;
    maxComments: number;
  }): number {
    const reactionCredits = Math.ceil(config.maxReactions / 10);
    const commentCredits = Math.ceil(config.maxComments / 10);
    
    return reactionCredits + commentCredits;
  }
}
