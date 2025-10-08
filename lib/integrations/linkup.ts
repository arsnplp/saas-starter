import { z } from 'zod';

const LINKUP_API_BASE_URL = 'https://api.linkup.so/v1';

const linkupReactionSchema = z.object({
  id: z.string(),
  reaction_type: z.enum(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT']),
  reacted_at: z.string(),
  reactor: z.object({
    profile_id: z.string(),
    public_id: z.string(),
    profile_url: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    headline: z.string().optional(),
    profile_picture_url: z.string().optional(),
  }),
});

const linkupCommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  commented_at: z.string(),
  commenter: z.object({
    profile_id: z.string(),
    public_id: z.string(),
    profile_url: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    headline: z.string().optional(),
    profile_picture_url: z.string().optional(),
  }),
});

const linkupPostEngagementSchema = z.object({
  reactions: z.array(linkupReactionSchema),
  comments: z.array(linkupCommentSchema),
  metadata: z.object({
    post_url: z.string(),
    total_reactions: z.number(),
    total_comments: z.number(),
  }),
});

const linkupProfileSchema = z.object({
  profile_id: z.string(),
  public_id: z.string(),
  profile_url: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  profile_picture_url: z.string().optional(),
  current_company: z.object({
    name: z.string().optional(),
    industry: z.string().optional(),
    size: z.number().optional(),
    domain: z.string().optional(),
  }).optional(),
  experience: z.array(z.object({
    title: z.string().optional(),
    company: z.string().optional(),
    duration: z.string().optional(),
  })).optional(),
});

export type LinkupReaction = z.infer<typeof linkupReactionSchema>;
export type LinkupComment = z.infer<typeof linkupCommentSchema>;
export type LinkupPostEngagement = z.infer<typeof linkupPostEngagementSchema>;
export type LinkupProfile = z.infer<typeof linkupProfileSchema>;

export class LinkupClient {
  private apiKey: string;
  private mockMode: boolean;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LINKUP_API_KEY || '';
    this.mockMode = process.env.LINKUP_MOCK === '1' || !this.apiKey;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any) {
    if (this.mockMode) {
      return this.getMockResponse(endpoint);
    }

    const response = await fetch(`${LINKUP_API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`LinkUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private getMockResponse(endpoint: string) {
    if (endpoint.includes('/posts/') && endpoint.includes('/engagement')) {
      return {
        reactions: [
          {
            id: 'mock-reaction-1',
            reaction_type: 'LIKE',
            reacted_at: new Date().toISOString(),
            reactor: {
              profile_id: 'mock-profile-1',
              public_id: 'john-doe',
              profile_url: 'https://linkedin.com/in/john-doe',
              first_name: 'John',
              last_name: 'Doe',
              headline: 'CEO at TechCorp',
              profile_picture_url: 'https://via.placeholder.com/150',
            },
          },
          {
            id: 'mock-reaction-2',
            reaction_type: 'PRAISE',
            reacted_at: new Date().toISOString(),
            reactor: {
              profile_id: 'mock-profile-2',
              public_id: 'jane-smith',
              profile_url: 'https://linkedin.com/in/jane-smith',
              first_name: 'Jane',
              last_name: 'Smith',
              headline: 'VP of Engineering at StartupCo',
              profile_picture_url: 'https://via.placeholder.com/150',
            },
          },
        ],
        comments: [
          {
            id: 'mock-comment-1',
            text: 'Great insights! This is exactly what we needed.',
            commented_at: new Date().toISOString(),
            commenter: {
              profile_id: 'mock-profile-3',
              public_id: 'alex-johnson',
              profile_url: 'https://linkedin.com/in/alex-johnson',
              first_name: 'Alex',
              last_name: 'Johnson',
              headline: 'Product Manager at InnovateTech',
              profile_picture_url: 'https://via.placeholder.com/150',
            },
          },
        ],
        metadata: {
          post_url: 'https://linkedin.com/posts/example-123',
          total_reactions: 2,
          total_comments: 1,
        },
      };
    }

    if (endpoint.includes('/profiles/')) {
      return {
        profile_id: 'mock-profile-full',
        public_id: 'john-doe',
        profile_url: 'https://linkedin.com/in/john-doe',
        first_name: 'John',
        last_name: 'Doe',
        headline: 'CEO & Founder at TechCorp',
        summary: 'Experienced technology leader with 15+ years in SaaS and enterprise software.',
        location: 'San Francisco, CA',
        profile_picture_url: 'https://via.placeholder.com/150',
        current_company: {
          name: 'TechCorp',
          industry: 'Technology',
          size: 500,
          domain: 'techcorp.com',
        },
        experience: [
          {
            title: 'CEO & Founder',
            company: 'TechCorp',
            duration: '2018 - Present',
          },
          {
            title: 'VP Engineering',
            company: 'Previous Company',
            duration: '2015 - 2018',
          },
        ],
      };
    }

    if (endpoint.includes('/search/profiles')) {
      return {
        profiles: [
          {
            profile_id: 'search-result-1',
            public_id: 'cto-prospect',
            profile_url: 'https://linkedin.com/in/cto-prospect',
            first_name: 'Sarah',
            last_name: 'Williams',
            headline: 'CTO at GrowthStartup',
            location: 'New York, NY',
            profile_picture_url: 'https://via.placeholder.com/150',
            current_company: {
              name: 'GrowthStartup',
              industry: 'SaaS',
              size: 100,
            },
          },
        ],
        total: 1,
      };
    }

    return { error: 'Unknown endpoint' };
  }

  async getPostEngagement(postUrl: string): Promise<LinkupPostEngagement> {
    const postId = this.extractPostId(postUrl);
    const data = await this.makeRequest(`/posts/${postId}/engagement`);
    return linkupPostEngagementSchema.parse(data);
  }

  async getProfile(profileUrl: string): Promise<LinkupProfile> {
    const profileId = this.extractProfileId(profileUrl);
    const data = await this.makeRequest(`/profiles/${profileId}`);
    return linkupProfileSchema.parse(data);
  }

  async searchProfiles(filters: {
    title?: string;
    company?: string;
    location?: string;
    industry?: string;
    keywords?: string;
  }): Promise<{ profiles: LinkupProfile[]; total: number }> {
    const queryParams = new URLSearchParams();
    
    if (filters.title) queryParams.append('title', filters.title);
    if (filters.company) queryParams.append('company', filters.company);
    if (filters.location) queryParams.append('location', filters.location);
    if (filters.industry) queryParams.append('industry', filters.industry);
    if (filters.keywords) queryParams.append('keywords', filters.keywords);

    const data = await this.makeRequest(`/search/profiles?${queryParams.toString()}`);
    return {
      profiles: data.profiles.map((p: any) => linkupProfileSchema.parse(p)),
      total: data.total,
    };
  }

  private extractPostId(postUrl: string): string {
    const match = postUrl.match(/posts\/([^/?]+)/);
    return match ? match[1] : postUrl;
  }

  private extractProfileId(profileUrl: string): string {
    const match = profileUrl.match(/in\/([^/?]+)/);
    return match ? match[1] : profileUrl;
  }
}

export const linkupClient = new LinkupClient();
