'use server';

import { db } from '@/lib/db/drizzle';
import {
  monitoredCompanies,
  leadCollectionConfigs,
  companyPosts,
  webhookAccounts,
  scheduledCollections,
  linkedinConnections,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/db/queries';
import { WebhookManager } from '@/lib/services/webhook-manager';

export async function addMonitoredCompanyAction(data: {
  linkedinCompanyUrl: string;
  companyName: string;
}) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    console.log(`📝 Ajout entreprise suivie: ${data.companyName}`);

    const normalizedUrl = data.linkedinCompanyUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    const existing = await db.query.monitoredCompanies.findFirst({
      where: and(
        eq(monitoredCompanies.teamId, teamId),
        eq(monitoredCompanies.linkedinCompanyUrl, normalizedUrl)
      ),
    });

    if (existing) {
      return { success: false, error: 'Cette entreprise est déjà suivie' };
    }

    const [company] = await db
      .insert(monitoredCompanies)
      .values({
        teamId,
        linkedinCompanyUrl: normalizedUrl,
        companyName: data.companyName,
        addedBy: user.id,
      })
      .returning();

    await db.insert(leadCollectionConfigs).values({
      teamId,
      monitoredCompanyId: company.id,
      delayHours: 24,
      maxReactions: 50,
      maxComments: 50,
      isEnabled: true,
    });

    console.log(`✅ Entreprise ajoutée: ${company.id}`);

    revalidatePath('/dashboard/monitoring');

    return { success: true, company };
  } catch (error: any) {
    console.error('❌ Erreur ajout entreprise:', error);
    return { success: false, error: error.message };
  }
}

export async function removeMonitoredCompanyAction(companyId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    await db
      .delete(monitoredCompanies)
      .where(
        and(
          eq(monitoredCompanies.id, companyId),
          eq(monitoredCompanies.teamId, teamId)
        )
      );

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur suppression entreprise:', error);
    return { success: false, error: error.message };
  }
}

export async function updateCollectionConfigAction(
  companyId: string,
  config: {
    delayHours: number;
    maxReactions: number;
    maxComments: number;
    isEnabled: boolean;
  }
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    const company = await db.query.monitoredCompanies.findFirst({
      where: and(
        eq(monitoredCompanies.id, companyId),
        eq(monitoredCompanies.teamId, teamId)
      ),
      with: {
        collectionConfig: true,
      },
    });

    if (!company) {
      return { success: false, error: 'Entreprise non trouvée' };
    }

    if (company.collectionConfig) {
      await db
        .update(leadCollectionConfigs)
        .set({
          delayHours: config.delayHours,
          maxReactions: config.maxReactions,
          maxComments: config.maxComments,
          isEnabled: config.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(leadCollectionConfigs.id, company.collectionConfig.id));
    } else {
      await db.insert(leadCollectionConfigs).values({
        teamId,
        monitoredCompanyId: companyId,
        ...config,
      });
    }

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur mise à jour config:', error);
    return { success: false, error: error.message };
  }
}

export async function markPostsAsReadAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false };
  }

  try {
    await db
      .update(companyPosts)
      .set({ isNew: false })
      .where(eq(companyPosts.teamId, user.teamId));

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getMonitoringDataAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return {
      companies: [],
      recentPosts: [],
      webhookStatus: { hasAccount: false, isActive: false, accountInfo: null },
      newPostsCount: 0,
    };
  }

  const teamId = user.teamId;

  const companies = await db.query.monitoredCompanies.findMany({
    where: eq(monitoredCompanies.teamId, teamId),
    with: {
      collectionConfig: true,
    },
    orderBy: [desc(monitoredCompanies.lastPostAt)],
  });

  const companiesWithNewPosts = await Promise.all(
    companies.map(async (company) => {
      const newPosts = await db
        .select({ count: companyPosts.id })
        .from(companyPosts)
        .where(
          and(
            eq(companyPosts.monitoredCompanyId, company.id),
            eq(companyPosts.teamId, teamId),
            eq(companyPosts.isNew, true)
          )
        );

      return {
        ...company,
        newPostsCount: newPosts.length,
      };
    })
  );

  companiesWithNewPosts.sort((a, b) => {
    if (a.newPostsCount > 0 && b.newPostsCount === 0) return -1;
    if (a.newPostsCount === 0 && b.newPostsCount > 0) return 1;
    return new Date(b.lastPostAt || 0).getTime() - new Date(a.lastPostAt || 0).getTime();
  });

  const recentPosts = await db.query.companyPosts.findMany({
    where: eq(companyPosts.teamId, teamId),
    with: {
      monitoredCompany: true,
    },
    orderBy: [desc(companyPosts.publishedAt)],
    limit: 20,
  });

  const webhookStatus = await WebhookManager.getMonitoringStatus(teamId);

  const totalNewPosts = companiesWithNewPosts.reduce((sum, c) => sum + c.newPostsCount, 0);

  return {
    companies: companiesWithNewPosts,
    recentPosts,
    webhookStatus,
    newPostsCount: totalNewPosts,
  };
}

export async function setupWebhookAccountAction() {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://' + process.env.REPLIT_DEV_DOMAIN}/api/webhook/linkedin`;

    const { linkedinConnections } = await import('@/lib/db/schema');
    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, teamId),
    });

    if (!connection) {
      return {
        success: false,
        error: 'Connexion LinkedIn requise',
      };
    }

    const result = await WebhookManager.createWebhookAccount({
      teamId,
      userId: user.id,
      accountName: `Monitoring ${user.name || 'Team'}`,
      webhookUrl,
      loginToken: connection.loginToken,
      country: 'FR',
    });

    revalidatePath('/dashboard/monitoring');

    return { success: true, account: result.webhookAccount };
  } catch (error: any) {
    console.error('❌ Erreur setup webhook:', error);
    return { success: false, error: error.message };
  }
}

export async function toggleMonitoringAction(enable: boolean) {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false, error: 'Non authentifié' };
  }

  try {
    if (enable) {
      await WebhookManager.startMonitoring(user.teamId);
    } else {
      await WebhookManager.stopMonitoring(user.teamId);
    }

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAccountPostsAction(companyId: string) {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { posts: [] };
  }

  const teamId = user.teamId;

  const posts = await db.query.companyPosts.findMany({
    where: and(
      eq(companyPosts.monitoredCompanyId, companyId),
      eq(companyPosts.teamId, teamId)
    ),
    with: {
      scheduledCollection: true,
    },
    orderBy: [desc(companyPosts.publishedAt)],
  });

  await db
    .update(companyPosts)
    .set({ isNew: false })
    .where(
      and(
        eq(companyPosts.monitoredCompanyId, companyId),
        eq(companyPosts.teamId, teamId),
        eq(companyPosts.isNew, true)
      )
    );

  return { posts };
}

export async function configurePostCollectionAction(
  postId: string,
  config: {
    delayHours: number;
    maxReactions: number;
    maxComments: number;
    enabled: boolean;
  }
) {
  const user = await getUser();
  if (!user || !user.teamId) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;

  try {
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
      return { success: false, error: 'Post non trouvé' };
    }

    const existingCollection = await db.query.scheduledCollections.findFirst({
      where: eq(scheduledCollections.postId, postId),
    });

    const scheduledAt = new Date(post.publishedAt);
    scheduledAt.setHours(scheduledAt.getHours() + config.delayHours);

    if (existingCollection) {
      await db
        .update(scheduledCollections)
        .set({
          scheduledFor: scheduledAt,
          status: config.enabled ? 'pending' : 'cancelled',
          maxReactionsOverride: config.maxReactions,
          maxCommentsOverride: config.maxComments,
        })
        .where(eq(scheduledCollections.id, existingCollection.id));
    } else {
      const collectionConfig = post.monitoredCompany.collectionConfig;
      if (!collectionConfig) {
        return { success: false, error: 'Configuration de compte manquante' };
      }

      await db.insert(scheduledCollections).values({
        teamId,
        postId,
        configId: collectionConfig.id,
        scheduledFor: scheduledAt,
        status: config.enabled ? 'pending' : 'cancelled',
        maxReactionsOverride: config.maxReactions,
        maxCommentsOverride: config.maxComments,
      });
    }

    revalidatePath('/dashboard/monitoring');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur configuration post:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchPostsForAccountAction(companyId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    const company = await db.query.monitoredCompanies.findFirst({
      where: and(
        eq(monitoredCompanies.id, companyId),
        eq(monitoredCompanies.teamId, teamId)
      ),
    });

    if (!company) {
      return { success: false, error: 'Compte non trouvé' };
    }

    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, teamId),
    });

    if (!connection || !connection.loginToken) {
      return { success: false, error: 'Connexion LinkedIn non configurée. Veuillez d\'abord connecter votre compte LinkedIn.' };
    }

    console.log(`📥 Récupération des posts pour: ${company.companyName}`);

    const apiUrl = `${process.env.LINKUP_API_BASE || 'https://api.linkupapi.com'}/v1/posts/feed`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.LINKUP_API_KEY || '',
      },
      body: JSON.stringify({
        total_results: 10,
        login_token: connection.loginToken,
        country: 'FR',
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API LinkUp:', response.status, errorText);
      return { success: false, error: `Erreur API: ${response.status}` };
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      return { success: false, error: data.message || 'Erreur API LinkUp' };
    }

    const feedPosts = data.data?.Feed || [];
    console.log(`📊 ${feedPosts.length} posts récupérés du feed`);

    if (feedPosts.length > 0 && feedPosts[0]) {
      console.log('🔍 Exemple de post:', JSON.stringify({
        post_url: feedPosts[0].post_url,
        actor_url: feedPosts[0].actor?.url,
        actor_name: feedPosts[0].actor?.name,
        author_name: feedPosts[0].author?.name,
      }, null, 2));
    }

    const targetUrl = company.linkedinCompanyUrl.toLowerCase();
    const companyNameLower = company.companyName.toLowerCase();
    console.log(`🎯 Recherche de posts pour: "${company.companyName}" (URL: ${targetUrl})`);
    
    const isPersonalProfile = targetUrl.includes('/in/');
    
    let filteredPosts = feedPosts.filter((post: any) => {
      if (!post.post_url) return false;
      
      const postUrl = post.post_url.toLowerCase();
      const authorUrl = (post.actor?.url || '').toLowerCase();
      const authorName = (post.actor?.name || post.author?.name || '').toLowerCase();
      
      const nameMatch = authorName.includes(companyNameLower) || 
                        companyNameLower.includes(authorName.split(' ')[0]);
      
      if (isPersonalProfile) {
        const profileMatch = targetUrl.match(/\/in\/([^\/\?]+)/);
        if (profileMatch) {
          const profileId = profileMatch[1];
          const urlMatch = authorUrl.includes(`/in/${profileId}`) || 
                          postUrl.includes(`_${profileId}_`) ||
                          postUrl.includes(`/in/${profileId}/`);
          return urlMatch || nameMatch;
        }
      } else {
        const companyMatch = targetUrl.match(/\/company\/([^\/\?]+)/);
        if (companyMatch) {
          const companyId = companyMatch[1];
          const urlMatch = authorUrl.includes(`/company/${companyId}`) || 
                          postUrl.includes(`/company/${companyId}/`);
          return urlMatch || nameMatch;
        }
      }
      
      return nameMatch;
    });

    console.log(`🎯 ${filteredPosts.length} posts correspondent au profil surveillé`);

    let newPostsCount = 0;
    
    for (const post of filteredPosts) {
      const postId = extractPostId(post.post_url);
      if (!postId) continue;

      const existing = await db.query.companyPosts.findFirst({
        where: and(
          eq(companyPosts.postId, postId),
          eq(companyPosts.teamId, teamId)
        ),
      });

      if (existing) {
        continue;
      }

      await db.insert(companyPosts).values({
        teamId,
        monitoredCompanyId: companyId,
        postId,
        postUrl: post.post_url,
        authorName: post.actor?.name || company.companyName,
        authorUrl: post.actor?.url || `https://${company.linkedinCompanyUrl}`,
        content: post.commentary || '',
        mediaUrls: post.images || [],
        publishedAt: new Date(post.published_at || Date.now()),
        webhookPayload: post,
      });

      newPostsCount++;
    }

    if (newPostsCount > 0) {
      await db
        .update(monitoredCompanies)
        .set({
          totalPostsReceived: (company.totalPostsReceived || 0) + newPostsCount,
          lastPostAt: new Date(),
        })
        .where(eq(monitoredCompanies.id, companyId));
    }

    await db
      .update(linkedinConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedinConnections.teamId, teamId));

    console.log(`✅ ${newPostsCount} nouveaux posts ajoutés`);

    revalidatePath('/dashboard/monitoring');

    return { success: true, newPostsCount, totalFetched: filteredPosts.length };
  } catch (error: any) {
    console.error('❌ Erreur récupération posts:', error);
    return { success: false, error: error.message };
  }
}

function extractPostId(postUrl: string): string | null {
  const activityMatch = postUrl.match(/activity[:-](\d+)/i);
  if (activityMatch) return activityMatch[1];
  
  const ugcMatch = postUrl.match(/ugcPost[:-](\d+)/i);
  if (ugcMatch) return ugcMatch[1];
  
  const urnMatch = postUrl.match(/urn:li:[\w]+:(\d+)/);
  if (urnMatch) return urnMatch[1];
  
  return postUrl;
}

export async function extractLeadsFromPostAction(params: {
  postId: string;
  extractionType: 'reactions' | 'comments';
  maxCount: number;
}) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const teamId = user.teamId;
  if (!teamId) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  try {
    const post = await db.query.companyPosts.findFirst({
      where: and(
        eq(companyPosts.id, params.postId),
        eq(companyPosts.teamId, teamId)
      ),
    });

    if (!post) {
      return { success: false, error: 'Post non trouvé' };
    }

    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, teamId),
    });

    if (!connection || !connection.loginToken) {
      return { success: false, error: 'Connexion LinkedIn non configurée' };
    }

    console.log(`🔍 Extraction de ${params.extractionType} pour le post: ${post.postUrl}`);

    const apiEndpoint = params.extractionType === 'reactions' 
      ? '/v1/data/signals/posts/reactions'
      : '/v1/data/signals/posts/comments';

    const apiUrl = `${process.env.LINKUP_API_BASE || 'https://api.linkupapi.com'}${apiEndpoint}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.LINKUP_API_KEY || '',
      },
      body: JSON.stringify({
        post_url: post.postUrl,
        total_results: params.maxCount,
        login_token: connection.loginToken,
        country: 'FR',
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API LinkUp:', response.status, errorText);
      return { success: false, error: `Erreur API: ${response.status}` };
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      return { success: false, error: data.message || 'Erreur API LinkUp' };
    }

    const results = data.results || [];
    console.log(`📊 ${results.length} ${params.extractionType} récupéré(e)s`);

    let leadsCount = 0;
    const { leads: leadsTable } = await import('@/lib/db/schema');

    for (const item of results) {
      const profileUrl = item.profileUrl || item.profile_url;
      if (!profileUrl) continue;

      const existing = await db.query.leads.findFirst({
        where: and(
          eq(leadsTable.linkedinUrl, profileUrl),
          eq(leadsTable.teamId, teamId)
        ),
      });

      if (existing) {
        console.log(`⏭️ Lead déjà existant: ${profileUrl}`);
        continue;
      }

      const name = item.name || '';
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await db.insert(leadsTable).values({
        teamId,
        linkedinUrl: profileUrl,
        firstName,
        lastName,
        sourceMode: 'magnet',
        sourcePostUrl: post.postUrl,
        engagementType: params.extractionType === 'reactions' ? 'reaction' : 'comment',
        reactionType: params.extractionType === 'reactions' ? (item.reactionType || 'LIKE') : null,
        commentText: params.extractionType === 'comments' ? (item.text || item.comment_text) : null,
        profileData: item,
        score: 50,
        status: 'new',
      });

      leadsCount++;
    }

    await db
      .update(linkedinConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedinConnections.teamId, teamId));

    console.log(`✅ ${leadsCount} nouveaux leads créés`);

    revalidatePath('/dashboard/monitoring');
    revalidatePath('/dashboard/leads');

    return { success: true, leadsCount, totalExtracted: results.length };
  } catch (error: any) {
    console.error('❌ Erreur extraction leads:', error);
    return { success: false, error: error.message };
  }
}
