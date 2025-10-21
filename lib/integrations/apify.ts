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

function extractProfileIdentifier(url: string): string | null {
  const match = url.match(/\/in\/([^\/\?]+)|\/company\/([^\/\?]+)/i);
  return match ? (match[1] || match[2]).toLowerCase() : null;
}

export async function getProfilePosts(linkedinProfileUrl: string): Promise<LinkedInPost[]> {
  try {
    const run = await client.actor('apimaestro/linkedin-profile-posts').call({
      profileUrl: linkedinProfileUrl,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const profileIdentifier = extractProfileIdentifier(linkedinProfileUrl);
    
    if (!profileIdentifier) {
      console.warn(`Could not extract identifier from profile URL: ${linkedinProfileUrl}`);
      return [];
    }
    
    return items
      .map((item: any) => ({
        postId: item.postId || item.id || '',
        postUrl: item.postUrl || item.url || '',
        authorName: item.authorName || item.author?.name || '',
        authorUrl: item.authorUrl || item.author?.url || linkedinProfileUrl,
        content: item.content || item.text || '',
        publishedAt: item.publishedAt || item.createdAt || new Date().toISOString(),
        mediaUrls: item.mediaUrls || item.media || [],
        likeCount: item.likeCount || item.reactions?.total || 0,
        commentCount: item.commentCount || item.comments?.total || 0,
      }))
      .filter((post) => {
        const postUrlLower = post.postUrl.toLowerCase();
        return postUrlLower.includes(`/posts/${profileIdentifier}_`) || 
               postUrlLower.includes(`/posts/${profileIdentifier}-`);
      });
  } catch (error) {
    console.error('Error fetching profile posts from Apify:', error);
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
