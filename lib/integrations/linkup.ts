import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const LINKUP_API_BASE_URL = 'https://api.linkupapi.com/v1';

const linkupReactionSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  subtitle: z.string().optional(),
  profile_url: z.string().optional(),
  actor_urn: z.string().optional(),
  profile_picture: z.string().optional(),
  connection_degree: z.string().optional(),
});

const linkupCommentSchema = z.object({
  comment_text: z.string().optional(),
  commented_at: z.string().optional(),
  comment_urn: z.string().optional(),
  commenter: z.object({
    name: z.string().optional(),
    linkedin_url: z.string().optional(),
    occupation: z.string().optional(),
    profile_urn: z.string().optional(),
  }).optional(),
  commenter_name: z.string().optional(),
  commenter_headline: z.string().optional(),
  commenter_profile_url: z.string().optional(),
  commenter_profile_picture: z.string().optional(),
  connection_degree: z.string().optional(),
});

const linkupReactionsResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_results: z.number().optional().default(0),
    total_available_results: z.number().optional().default(0),
    reactions: z.array(linkupReactionSchema).optional().default([]),
    pagination: z.object({
      start_page: z.number(),
      end_page: z.number(),
      results_per_page: z.number(),
      pages_fetched: z.number(),
    }).optional(),
  }),
});

const linkupCommentsResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_results: z.number().optional().default(0),
    total_available_results: z.number().optional().default(0),
    comments: z.array(linkupCommentSchema).optional().default([]),
    pagination: z.object({
      start_page: z.number(),
      end_page: z.number(),
      results_per_page: z.number(),
      pages_fetched: z.number(),
    }).optional(),
  }),
});

export type LinkupReaction = z.infer<typeof linkupReactionSchema>;
export type LinkupComment = z.infer<typeof linkupCommentSchema>;

export interface LinkupPostEngagement {
  reactions: LinkupReaction[];
  comments: LinkupComment[];
  metadata: {
    post_url: string;
    total_reactions: number;
    total_comments: number;
  };
}

export class LinkupClient {
  private apiKey: string;
  private loginToken: string;
  private mockMode: boolean;

  constructor(apiKey?: string, loginToken?: string) {
    this.apiKey = apiKey || process.env.LINKUP_API_KEY || '';
    this.loginToken = loginToken || process.env.LINKUP_LOGIN_TOKEN || '';
    this.mockMode = process.env.LINKUP_MOCK === '1' || !this.apiKey;
  }

  private async makeRequest(endpoint: string, body: any) {
    if (this.mockMode) {
      return this.getMockResponse(endpoint);
    }

    if (!this.loginToken) {
      throw new Error('LinkedIn login_token is required. Please add LINKUP_LOGIN_TOKEN to your environment variables.');
    }

    const response = await fetch(`${LINKUP_API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        login_token: this.loginToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LinkUp API error (${endpoint}):`, response.status, errorText);
      throw new Error(`LinkUp API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`LinkUp API response (${endpoint}):`, JSON.stringify(data, null, 2));
    return data;
  }

  private getMockResponse(endpoint: string) {
    if (endpoint.includes('/posts/reactions')) {
      return {
        status: 'success',
        data: {
          total_results: 5,
          total_available_results: 5,
          reactions: [
            {
              type: 'LIKE',
              name: 'John Doe',
              subtitle: 'CEO at TechCorp',
              profile_url: 'https://linkedin.com/in/john-doe',
              profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '2nd',
            },
            {
              type: 'INTEREST',
              name: 'Jane Smith',
              subtitle: 'VP of Engineering at StartupCo',
              profile_url: 'https://linkedin.com/in/jane-smith',
              profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '1st',
            },
            {
              type: 'PRAISE',
              name: 'Alex Johnson',
              subtitle: 'Product Manager at InnovateTech',
              profile_url: 'https://linkedin.com/in/alex-johnson',
              profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '3rd',
            },
            {
              type: 'EMPATHY',
              name: 'Sarah Williams',
              subtitle: 'CTO at GrowthStartup',
              profile_url: 'https://linkedin.com/in/sarah-williams',
              connection_degree: '2nd',
            },
            {
              type: 'APPRECIATION',
              name: 'Michael Brown',
              subtitle: 'Founder at NextGen Solutions',
              profile_url: 'https://linkedin.com/in/michael-brown',
              profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '1st',
            },
          ],
          pagination: {
            start_page: 1,
            end_page: 1,
            results_per_page: 50,
            pages_fetched: 1,
          },
        },
      };
    }

    if (endpoint.includes('/posts/extract-comments')) {
      return {
        status: 'success',
        data: {
          total_results: 3,
          total_available_results: 3,
          comments: [
            {
              comment_text: 'Great insights! This is exactly what we needed.',
              commented_at: new Date().toISOString(),
              commenter_name: 'Emily Davis',
              commenter_headline: 'Marketing Director at BrandCo',
              commenter_profile_url: 'https://linkedin.com/in/emily-davis',
              commenter_profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '2nd',
            },
            {
              comment_text: 'Interesting perspective. Would love to discuss this further.',
              commented_at: new Date().toISOString(),
              commenter_name: 'David Martinez',
              commenter_headline: 'Sales Lead at EnterpriseHub',
              commenter_profile_url: 'https://linkedin.com/in/david-martinez',
              commenter_profile_picture: 'https://via.placeholder.com/150',
              connection_degree: '1st',
            },
            {
              comment_text: 'Thanks for sharing this valuable information!',
              commented_at: new Date().toISOString(),
              commenter_name: 'Lisa Anderson',
              commenter_headline: 'HR Manager at PeopleCorp',
              commenter_profile_url: 'https://linkedin.com/in/lisa-anderson',
              connection_degree: '3rd',
            },
          ],
          pagination: {
            start_page: 1,
            end_page: 1,
            results_per_page: 50,
            pages_fetched: 1,
          },
        },
      };
    }

    return { status: 'error', data: null };
  }

  async getPostEngagement(postUrl: string, totalResults: number = 50): Promise<LinkupPostEngagement> {
    const reactionsResponse = await this.makeRequest('/posts/reactions', {
      post_url: postUrl,
      total_results: totalResults,
      country: 'FR',
    });

    const commentsResponse = await this.makeRequest('/posts/extract-comments', {
      post_url: postUrl,
      total_results: totalResults,
      country: 'FR',
    });

    const reactionsData = linkupReactionsResponseSchema.parse(reactionsResponse);
    const commentsData = linkupCommentsResponseSchema.parse(commentsResponse);

    return {
      reactions: reactionsData.data.reactions,
      comments: commentsData.data.comments,
      metadata: {
        post_url: postUrl,
        total_reactions: reactionsData.data.total_available_results,
        total_comments: commentsData.data.total_available_results,
      },
    };
  }
}

export async function getLinkupClient(teamId: number): Promise<LinkupClient> {
  const connection = await db.query.linkedinConnections.findFirst({
    where: eq(linkedinConnections.teamId, teamId),
  });

  if (connection && connection.isActive) {
    await db
      .update(linkedinConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedinConnections.teamId, teamId));

    return new LinkupClient(undefined, connection.loginToken);
  }

  return new LinkupClient();
}

export const linkupClient = new LinkupClient();

const linkupProfileSchema = z.object({
  name: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  summary: z.string().optional(),
  experience: z.array(z.object({
    title: z.string().optional(),
    company: z.string().optional(),
    company_size: z.string().optional(),
    duration: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
  })).optional(),
  education: z.array(z.object({
    school: z.string().optional(),
    degree: z.string().optional(),
    field: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })).optional(),
  skills: z.array(z.string()).optional(),
});

const linkupProfileResponseSchema = z.object({
  status: z.string(),
  data: linkupProfileSchema,
});

export type LinkupProfile = z.infer<typeof linkupProfileSchema>;

export async function fetchLinkedInProfile(profileUrl: string): Promise<LinkupProfile> {
  const mockMode = process.env.LINKUP_MOCK === '1' || !process.env.LINKUP_API_KEY;
  
  if (mockMode) {
    return {
      name: 'Mock User',
      headline: 'CEO at TechCorp',
      location: 'Paris, France',
      industry: 'Technology',
      summary: 'Experienced CEO with a passion for innovation',
      experience: [
        {
          title: 'CEO',
          company: 'TechCorp',
          company_size: '51-200',
          duration: '2 years',
          description: 'Leading the company to success',
        },
      ],
      education: [
        {
          school: 'HEC Paris',
          degree: 'MBA',
          field: 'Business Administration',
        },
      ],
      skills: ['Leadership', 'Strategy', 'Innovation'],
    };
  }

  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY is required');
  }

  const response = await fetch(`${LINKUP_API_BASE_URL}/profile/info`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      linkedin_url: profileUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LinkUp profile API error:', response.status, errorText);
    throw new Error(`LinkUp profile API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parsed = linkupProfileResponseSchema.parse(data);
  
  return parsed.data;
}
