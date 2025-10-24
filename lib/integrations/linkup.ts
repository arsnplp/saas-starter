import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const LINKUP_API_BASE_URL = 'https://api.linkupapi.com/v1';

/**
 * Nettoie automatiquement les URLs LinkedIn pour éviter les erreurs API
 * - Enlève les paramètres de tracking (utm_source, utm_medium, rcm, etc.)
 * - Décode les caractères HTML (&amp; -> &)
 * - Décode les caractères URL (%XX)
 * - Garde uniquement l'URL de base propre
 */
function cleanLinkedInUrl(url: string): string {
  if (!url) return url;
  
  try {
    // Décoder les entités HTML (&amp; -> &)
    let cleanUrl = url.replace(/&amp;/g, '&');
    
    // Parser l'URL
    const urlObj = new URL(cleanUrl);
    
    // Garder le pathname ENCODÉ (ne pas décoder) pour LinkUp
    // Juste enlever les query params
    const pathname = urlObj.pathname;
    
    // Pour les posts: retourner juste origin + pathname (SANS query params)
    // LinkUp accepte l'URL complète du post telle quelle
    if (pathname.includes('/posts/') || pathname.includes('/feed/update/')) {
      return `https://www.linkedin.com${pathname}`;
    }
    
    // Pour les profils: garder uniquement /in/username (décodé pour les profils)
    const profileMatch = pathname.match(/\/in\/([^\/\?]+)/);
    if (profileMatch) {
      // Pour les profils, on peut décoder
      const username = decodeURIComponent(profileMatch[1]);
      return `https://www.linkedin.com/in/${username}`;
    }
    
    // Pour les company: garder uniquement /company/name
    const companyMatch = pathname.match(/\/company\/([^\/\?]+)/);
    if (companyMatch) {
      return `https://www.linkedin.com/company/${companyMatch[1]}`;
    }
    
    // Fallback: origin + pathname (sans query)
    return `${urlObj.origin}${pathname}`;
  } catch (error) {
    // Si le parsing échoue, au moins enlever les query params
    console.warn('URL parsing failed, basic cleanup:', error);
    return url.split('?')[0].replace(/&amp;/g, '&');
  }
}

/**
 * Convertit les URLs de posts LinkedIn vers le format accepté par LinkUp API
 * 
 * Formats d'entrée possibles:
 * - https://www.linkedin.com/posts/username-ugcPost-XXXXX-XXXX
 * - https://www.linkedin.com/posts/username_activity-XXXXX-XXXX
 * - https://www.linkedin.com/posts/username_share-XXXXX-XXXX
 * - https://www.linkedin.com/feed/update/urn:li:activity:XXXXX
 * 
 * Formats de sortie testés dans l'ordre:
 * 1. Remplacement ugcPost-/share- → activity-
 * 2. Format URN (urn:li:activity:...)
 * 3. URL originale (fallback)
 */
function convertLinkedInPostUrl(url: string): string[] {
  console.log('\n🔄 ========== CONVERSION URL LINKEDIN ==========');
  console.log('📥 URL originale:', url);
  
  const variations: string[] = [];
  const cleanUrl = cleanLinkedInUrl(url);
  console.log('🧹 URL nettoyée:', cleanUrl);
  
  // Variation 1: Remplacer "ugcPost-" ou "_share-" par "activity-"
  if (cleanUrl.includes('ugcPost-') || cleanUrl.includes('_share-')) {
    const activityUrl = cleanUrl
      .replace(/ugcPost-/g, 'activity-')
      .replace(/_share-/g, '_activity-');
    variations.push(activityUrl);
    console.log('✨ Variation 1 (activity):', activityUrl);
  }
  
  // Variation 2: Essayer le format URN
  const urnMatch = cleanUrl.match(/activity[-_](\d+)/);
  if (urnMatch) {
    const urnUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${urnMatch[1]}`;
    variations.push(urnUrl);
    console.log('✨ Variation 2 (URN):', urnUrl);
  }
  
  // Variation 3: URL originale comme fallback
  variations.push(cleanUrl);
  console.log('✨ Variation 3 (original):', cleanUrl);
  
  console.log('📊 Nombre total de variations:', variations.length);
  console.log('==============================================\n');
  
  return variations;
}

// === SCHEMAS ZOD ===

const linkupReactionSchema = z.object({
  name: z.string(),
  job_title: z.string().optional().nullable(),
  profile_url: z.string(),
  profile_picture: z.string().optional().nullable(),
});

const linkupCommenterSchema = z.object({
  name: z.string(),
  profile_urn: z.string().optional().nullable(),
  linkedin_url: z.string(),
  occupation: z.string().optional().nullable(),
});

const linkupCommentSchema = z.object({
  comment_urn: z.string().optional().nullable(),
  tracking_id: z.string().optional().nullable(),
  comment_text: z.string().optional().nullable(),
  created_time: z.number().optional().nullable(),
  commenter: linkupCommenterSchema,
});

const linkupReactionsResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_reactions: z.number(),
    reactions: z.array(linkupReactionSchema),
  }),
});

const linkupCommentsResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_results: z.number(),
    total_available_results: z.number().optional(),
    comments: z.array(linkupCommentSchema),
    pagination: z.object({
      start_page: z.number(),
      end_page: z.number(),
      results_per_page: z.number(),
      pages_fetched: z.number(),
    }).optional(),
  }),
});

const linkupProfileResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    public_id: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    name: z.string().optional(),
    headline: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
    industry: z.string().optional(),
    experience: z.array(z.object({
      company: z.string(),
      title: z.string(),
      description: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    })).optional(),
    education: z.array(z.object({
      school: z.string(),
      degree: z.string().optional(),
      field_of_study: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    })).optional(),
    skills: z.array(z.string()).optional(),
    profile_picture_url: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
  }),
});

const linkupProfileSearchResultSchema = z.object({
  name: z.string(),
  job_title: z.string().optional().nullable(),
  connection_level: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  profile_url: z.string(),
  profile_picture: z.string().optional().nullable(),
  invitation_state: z.string().optional().nullable(),
});

const linkupProfileSearchResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_results: z.number(),
    total_available_results: z.number(),
    profiles: z.array(linkupProfileSearchResultSchema),
    pagination: z.object({
      start_page: z.number(),
      end_page: z.number(),
      results_per_page: z.number(),
      pages_fetched: z.number(),
    }).optional(),
  }),
});

const linkupCompanyInfoSchema = z.object({
  status: z.string(),
  data: z.object({
    name: z.string(),
    universalName: z.string().optional(),
    description: z.string().optional(),
    tagline: z.string().optional(),
    websiteUrl: z.string().optional(),
    industry: z.string().optional(),
    employeeCount: z.number().optional(),
    employeeCountRange: z.object({
      start: z.number(),
      end: z.number(),
    }).optional(),
    headquarter: z.object({
      country: z.string().optional(),
      geographicArea: z.string().optional(),
      city: z.string().optional(),
      line1: z.string().optional(),
      line2: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
    }).optional(),
    logoUrl: z.string().optional(),
    locations: z.array(z.object({
      description: z.string().optional(),
      headquarter: z.boolean().optional(),
      address: z.object({
        country: z.string().optional(),
        city: z.string().optional(),
        line1: z.string().optional(),
      }).optional(),
    })).optional(),
    phone: z.string().optional(),
    followersCount: z.number().optional(),
  }),
});

const linkupProfileEnrichmentSchema = z.object({
  status: z.string(),
  data: z.object({
    person_searched: z.object({
      first_name: z.string(),
      last_name: z.string(),
      company_name: z.string(),
    }),
    linkedin_profile: z.object({
      linkedin_url: z.string(),
      profile_title: z.string().optional(),
      profile_description: z.string().optional(),
    }).optional(),
    full_profile_data: z.object({
      public_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      headline: z.string().optional(),
      location: z.string().optional(),
      summary: z.string().optional(),
      industry: z.string().optional(),
      experience: z.array(z.object({
        company: z.string(),
        title: z.string(),
        description: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      })).optional(),
      education: z.array(z.object({
        school: z.string(),
        degree: z.string().optional(),
        field_of_study: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      })).optional(),
      skills: z.array(z.string()).optional(),
      profile_picture_url: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
    }).optional(),
  }),
});

export type LinkUpReaction = z.infer<typeof linkupReactionSchema>;
export type LinkUpComment = z.infer<typeof linkupCommentSchema>;
export type LinkUpProfileSearchResult = z.infer<typeof linkupProfileSearchResultSchema>;
export type LinkUpCompanyInfo = z.infer<typeof linkupCompanyInfoSchema>['data'];
export type LinkUpProfileEnrichment = z.infer<typeof linkupProfileEnrichmentSchema>['data'];

// === FETCH HELPERS ===

async function getLinkedInLoginToken(teamId: number): Promise<string | null> {
  const connection = await db.query.linkedinConnections.findFirst({
    where: eq(linkedinConnections.teamId, teamId),
  });

  if (connection && connection.isActive) {
    await db
      .update(linkedinConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedinConnections.teamId, teamId));
    return connection.loginToken;
  }

  return null;
}

// === API FUNCTIONS ===

/**
 * Extrait les commentaires d'un post LinkedIn
 */
export async function extractLinkedInComments(
  postUrl: string,
  totalResults: number = 100,
  teamId: number
): Promise<LinkUpComment[]> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  const loginToken = await getLinkedInLoginToken(teamId);
  if (!loginToken) {
    throw new Error('Connexion LinkedIn requise. Configurez LinkUp dans Intégrations.');
  }

  console.log('\n🚀 ===== EXTRACTION COMMENTAIRES =====');
  console.log('🔗 Post URL:', postUrl);
  console.log('📊 Résultats demandés:', totalResults);

  const urlVariations = convertLinkedInPostUrl(postUrl);
  let lastError: Error | null = null;
  
  for (let i = 0; i < urlVariations.length; i++) {
    const testUrl = urlVariations[i];
    console.log(`\n🧪 Test ${i + 1}/${urlVariations.length} avec URL:`, testUrl);

    try {
      const response = await fetch(`${LINKUP_API_BASE_URL}/posts/extract-comments`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_url: testUrl,
          total_results: totalResults,
          login_token: loginToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ Échec HTTP ${response.status}:`, errorText);
        lastError = new Error(`API returned ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`✅ Succès ! Statut:`, data.status);
      console.log(`📦 Réponse complète de l'API:`, JSON.stringify(data, null, 2));
      
      const parsed = linkupCommentsResponseSchema.parse(data);
      console.log(`📝 Commentaires extraits:`, parsed.data.total_results);
      console.log(`📊 Total disponible:`, parsed.data.total_available_results);
      console.log('=====================================\n');
      
      return parsed.data.comments;
      
    } catch (error) {
      console.error(`❌ Erreur lors du test:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  console.error('💥 Toutes les variations ont échoué');
  console.log('=====================================\n');
  throw lastError || new Error('Impossible d\'extraire les commentaires du post');
}

/**
 * Extrait les réactions d'un post LinkedIn
 */
export async function extractLinkedInReactions(
  postUrl: string,
  totalResults: number = 100,
  teamId: number
): Promise<LinkUpReaction[]> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  const loginToken = await getLinkedInLoginToken(teamId);
  if (!loginToken) {
    throw new Error('Connexion LinkedIn requise. Configurez LinkUp dans Intégrations.');
  }

  console.log('\n🚀 ===== EXTRACTION RÉACTIONS =====');
  console.log('🔗 Post URL:', postUrl);
  console.log('📊 Résultats demandés:', totalResults);

  const urlVariations = convertLinkedInPostUrl(postUrl);
  let lastError: Error | null = null;
  
  for (let i = 0; i < urlVariations.length; i++) {
    const testUrl = urlVariations[i];
    console.log(`\n🧪 Test ${i + 1}/${urlVariations.length} avec URL:`, testUrl);

    try {
      const response = await fetch(`${LINKUP_API_BASE_URL}/posts/reactions`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_url: testUrl,
          total_results: totalResults,
          login_token: loginToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ Échec HTTP ${response.status}:`, errorText);
        lastError = new Error(`API returned ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`✅ Succès ! Statut:`, data.status);
      
      const parsed = linkupReactionsResponseSchema.parse(data);
      console.log(`👍 Réactions extraites:`, parsed.data.total_reactions);
      console.log('===================================\n');
      
      return parsed.data.reactions;
      
    } catch (error) {
      console.error(`❌ Erreur lors du test:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  console.error('💥 Toutes les variations ont échoué');
  console.log('===================================\n');
  throw lastError || new Error('Impossible d\'extraire les réactions du post');
}

/**
 * Récupère les informations d'un profil LinkedIn
 */
export async function fetchLinkedInProfile(
  profileUrl: string,
  teamId: number
): Promise<z.infer<typeof linkupProfileResponseSchema>['data']> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  let loginToken: string | null = null;
  if (teamId) {
    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, teamId),
    });
    
    console.log('🔍 fetchLinkedInProfile - Connection lookup:', {
      teamId,
      connectionFound: !!connection,
      isActive: connection?.isActive,
      hasLoginToken: !!connection?.loginToken,
    });
    
    if (connection && connection.isActive) {
      loginToken = connection.loginToken;
      await db
        .update(linkedinConnections)
        .set({ lastUsedAt: new Date() })
        .where(eq(linkedinConnections.teamId, teamId));
    }
  }

  const cleanedUrl = cleanLinkedInUrl(profileUrl);
  
  const requestBody: any = {
    linkedin_url: cleanedUrl,
  };

  if (loginToken) {
    requestBody.login_token = loginToken;
  }

  console.log('🔍 fetchLinkedInProfile - Request:', {
    url: `${LINKUP_API_BASE_URL}/profile/info`,
    hasApiKey: !!apiKey,
    hasLoginToken: !!loginToken,
    originalUrl: profileUrl,
    cleanedUrl: cleanedUrl,
  });

  const response = await fetch(`${LINKUP_API_BASE_URL}/profile/info`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ LinkUp profile API error:', response.status, errorText);
    
    // Parse l'erreur pour afficher un message détaillé
    let errorDetails = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch {
      // Garder le texte brut si pas JSON
    }
    
    throw new Error(`LinkUp API ${response.status}: ${errorDetails}`);
  }

  const data = await response.json();
  const parsed = linkupProfileResponseSchema.parse(data);
  
  return parsed.data;
}

/**
 * Recherche des profils LinkedIn par critères
 */
export async function searchLinkedInProfiles(params: {
  companyUrl?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  keyword?: string;
  totalResults?: number;
  teamId: number;
}): Promise<LinkUpProfileSearchResult[]> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  const loginToken = await getLinkedInLoginToken(params.teamId);
  if (!loginToken) {
    throw new Error('Connexion LinkedIn requise. Configurez LinkUp dans Intégrations.');
  }

  console.log('🔍 Recherche de profils LinkedIn:', {
    companyUrl: params.companyUrl,
    title: params.title,
    totalResults: params.totalResults || 10,
  });

  const response = await fetch(`${LINKUP_API_BASE_URL}/profile/search`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_url: params.companyUrl,
      title: params.title,
      first_name: params.firstName,
      last_name: params.lastName,
      location: params.location,
      keyword: params.keyword,
      total_results: params.totalResults || 10,
      login_token: loginToken,
      country: 'FR',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ LinkUp profile search error:', response.status, errorText);
    
    let errorDetails = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch {
      // Keep raw text if not JSON
    }
    
    throw new Error(`LinkUp API ${response.status}: ${errorDetails}`);
  }

  const data = await response.json();
  const parsed = linkupProfileSearchResponseSchema.parse(data);
  
  console.log(`✅ Profils trouvés: ${parsed.data.total_results}`);
  
  return parsed.data.profiles;
}

/**
 * Enrichit un profil LinkedIn pour récupérer email et téléphone
 */
export async function enrichLinkedInProfile(params: {
  firstName: string;
  lastName: string;
  companyName: string;
}): Promise<LinkUpProfileEnrichment> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  console.log('💎 Enrichissement de profil:', {
    name: `${params.firstName} ${params.lastName}`,
    company: params.companyName,
  });

  const response = await fetch(`${LINKUP_API_BASE_URL}/data/profil/enrich`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      first_name: params.firstName,
      last_name: params.lastName,
      company_name: params.companyName,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ LinkUp profile enrichment error:', response.status, errorText);
    
    let errorDetails = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch {
      // Keep raw text if not JSON
    }
    
    throw new Error(`LinkUp API ${response.status}: ${errorDetails}`);
  }

  const data = await response.json();
  const parsed = linkupProfileEnrichmentSchema.parse(data);
  
  console.log('✅ Profil enrichi:', {
    linkedinUrl: parsed.data.linkedin_profile?.linkedin_url,
    hasEmail: !!parsed.data.full_profile_data?.email,
    hasPhone: !!parsed.data.full_profile_data?.phone,
  });
  
  return parsed.data;
}

/**
 * Récupère les informations d'une entreprise LinkedIn
 */
export async function getCompanyInfo(params: {
  companyUrl: string;
  teamId: number;
}): Promise<LinkUpCompanyInfo> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('LINKUP_API_KEY non configurée');
  }

  const loginToken = await getLinkedInLoginToken(params.teamId);
  if (!loginToken) {
    throw new Error('Connexion LinkedIn requise. Configurez LinkUp dans Intégrations.');
  }

  const cleanedUrl = cleanLinkedInUrl(params.companyUrl);

  console.log('🏢 Récupération infos entreprise:', cleanedUrl);

  const response = await fetch(`${LINKUP_API_BASE_URL}/companies/info`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_url: cleanedUrl,
      login_token: loginToken,
      country: 'FR',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ LinkUp company info error:', response.status, errorText);
    
    let errorDetails = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch {
      // Keep raw text if not JSON
    }
    
    throw new Error(`LinkUp API ${response.status}: ${errorDetails}`);
  }

  const data = await response.json();
  const parsed = linkupCompanyInfoSchema.parse(data);
  
  console.log('✅ Infos entreprise récupérées:', {
    name: parsed.data.name,
    employees: parsed.data.employeeCount,
    hasWebsite: !!parsed.data.websiteUrl,
  });
  
  return parsed.data;
}

/**
 * Client LinkUp pour faciliter les appels API
 */
export async function getLinkupClient(teamId: number) {
  return {
    extractComments: async (postUrl: string, maxResults: number) => {
      return extractLinkedInComments(postUrl, maxResults, teamId);
    },
    extractReactions: async (postUrl: string, maxResults: number) => {
      return extractLinkedInReactions(postUrl, maxResults, teamId);
    },
    getProfile: async (linkedinUrl: string) => {
      return fetchLinkedInProfile(linkedinUrl, teamId);
    },
    searchProfiles: async (filters: any) => {
      return searchLinkedInProfiles({ ...filters, teamId });
    },
  };
}
