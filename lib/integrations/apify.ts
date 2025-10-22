import { ApifyClient } from 'apify-client';

const APIFY_API_KEY = process.env.APIFY_API_KEY;

if (!APIFY_API_KEY) {
  throw new Error('APIFY_API_KEY is not defined');
}

const client = new ApifyClient({
  token: APIFY_API_KEY,
});

export interface LinkedInPost {
  postId: string;
  postUrl: string;
  authorName: string;
  authorUrl: string;
  content: string;
  publishedAt: string;
  postType?: string;
  mediaUrls?: string[];
  likeCount?: number;
  commentCount?: number;
}

export interface LinkedInEngagement {
  type: 'reaction' | 'comment';
  profileUrl: string;
  profileName: string;
  profileTitle?: string;
  profileCompany?: string;
  profilePictureUrl?: string;
  reactionType?: string;
  commentText?: string;
  commentedAt?: string;
}


export async function getProfilePosts(linkedinProfileUrl: string, maxPosts: number = 5, includeReposts: boolean = false): Promise<LinkedInPost[]> {
  try {
    const postsToFetch = includeReposts ? maxPosts : Math.min(maxPosts * 5, 20);
    
    console.log('🔍 Apify: Fetching posts for URL:', linkedinProfileUrl, 'maxPosts:', maxPosts, 'includeReposts:', includeReposts, 'postsToFetch:', postsToFetch);
    
    const run = await client.actor('apimaestro/linkedin-profile-posts').call({
      username: linkedinProfileUrl,
      total_posts: postsToFetch,
    });

    console.log('✅ Apify run completed:', {
      runId: run.id,
      status: run.status,
      datasetId: run.defaultDatasetId,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`📊 Apify returned ${items.length} items`);
    
    if (items.length > 0) {
      console.log('📝 First item structure:', JSON.stringify(items[0], null, 2));
    }
    
    let filteredItems = items;
    
    if (!includeReposts) {
      filteredItems = items.filter((item: any) => {
        const postType = item.post_type || 'regular';
        return postType === 'regular';
      });
      console.log(`🔍 Filtered to ${filteredItems.length} original posts (excluded reposts)`);
      
      filteredItems = filteredItems.slice(0, maxPosts);
      console.log(`✂️ Trimmed to ${filteredItems.length} posts (requested: ${maxPosts})`);
    }
    
    return filteredItems.map((item: any) => ({
      postId: String(item.urn?.ugcPost_urn || item.full_urn || item.urn?.activity_urn || ''),
      postUrl: String(item.url || ''),
      authorName: String(item.author ? `${item.author.first_name || ''} ${item.author.last_name || ''}`.trim() : ''),
      authorUrl: String(item.author?.profile_url || linkedinProfileUrl),
      content: String(item.text || ''),
      publishedAt: new Date(item.posted_at?.timestamp || item.posted_at?.date || new Date()).toISOString(),
      postType: String(item.post_type || 'regular'),
      mediaUrls: item.media?.url ? [item.media.url] : [],
      likeCount: item.stats?.total_reactions || 0,
      commentCount: item.stats?.comments || 0,
    }));
  } catch (error) {
    console.error('❌ Error fetching profile posts from Apify:', error);
    throw new Error(`Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPostReactions(postUrl: string): Promise<LinkedInEngagement[]> {
  try {
    const run = await client.actor('apimaestro/linkedin-post-reactions').call({
      postUrl: postUrl,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      type: 'reaction' as const,
      profileUrl: item.profileUrl || item.url || '',
      profileName: item.name || item.fullName || '',
      profileTitle: item.title || item.headline || '',
      profileCompany: item.company || item.companyName || '',
      profilePictureUrl: item.profilePictureUrl || item.photo || '',
      reactionType: item.reactionType || item.type || 'LIKE',
    }));
  } catch (error) {
    console.error('Error fetching post reactions from Apify:', error);
    throw new Error(`Failed to fetch reactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPostComments(postUrl: string): Promise<LinkedInEngagement[]> {
  try {
    const run = await client.actor('apimaestro/linkedin-post-comments-replies-engagements-scraper-no-cookies').call({
      postUrl: postUrl,
      pageNumber: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      type: 'comment' as const,
      profileUrl: item.authorUrl || item.author?.url || '',
      profileName: item.authorName || item.author?.name || '',
      profileTitle: item.authorTitle || item.author?.title || '',
      profileCompany: item.authorCompany || item.author?.company || '',
      profilePictureUrl: item.authorPictureUrl || item.author?.photo || '',
      commentText: item.text || item.content || '',
      commentedAt: item.createdAt || item.timestamp || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching post comments from Apify:', error);
    throw new Error(`Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPostEngagements(postUrl: string, options?: {
  includeReactions?: boolean;
  includeComments?: boolean;
}): Promise<LinkedInEngagement[]> {
  const { includeReactions = true, includeComments = true } = options || {};
  
  const results: LinkedInEngagement[] = [];

  try {
    if (includeReactions) {
      const reactions = await getPostReactions(postUrl);
      results.push(...reactions);
    }

    if (includeComments) {
      const comments = await getPostComments(postUrl);
      results.push(...comments);
    }

    return results;
  } catch (error) {
    console.error('Error fetching post engagements from Apify:', error);
    throw new Error(`Failed to fetch engagements: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ApifyCreditsInfo {
  estimatedCost: number;
  message: string;
}

export function estimateCreditsUsage(reactionsCount: number, commentsCount: number): ApifyCreditsInfo {
  const totalItems = reactionsCount + commentsCount;
  const estimatedCost = Math.ceil(totalItems / 100);
  
  return {
    estimatedCost,
    message: `Environ ${estimatedCost} crédit${estimatedCost > 1 ? 's' : ''} Apify seront utilisés pour extraire ${totalItems} engagements (${reactionsCount} réactions + ${commentsCount} commentaires).`
  };
}
