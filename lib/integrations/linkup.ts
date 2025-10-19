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
  
  const formats: string[] = [];
  
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Format 1: Remplacer ugcPost-/share- par activity-
    let pathModified = false;
    if (pathname.includes('ugcPost-')) {
      pathname = pathname.replace('ugcPost-', 'activity-');
      pathModified = true;
    } else if (pathname.includes('_share-') || pathname.includes('-share-')) {
      pathname = pathname.replace('_share-', '_activity-').replace('-share-', '-activity-');
      pathModified = true;
    }
    
    if (pathModified) {
      const format1 = `https://www.linkedin.com${pathname}`;
      formats.push(format1);
      console.log('✅ Format 1 (converti→activity):', format1);
    }
    
    // Format 2: Essayer d'extraire l'ID et créer un URN
    const idMatch = pathname.match(/(\d{19})/); // LinkedIn activity IDs ont 19 chiffres
    if (idMatch) {
      const activityId = idMatch[1];
      const format2 = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`;
      formats.push(format2);
      console.log('✅ Format 2 (URN):', format2);
    }
    
    // Format 3: URL originale (fallback)
    formats.push(url);
    console.log('✅ Format 3 (original):', url);
    
  } catch (error) {
    console.error('⚠️ Erreur parsing URL:', error);
    formats.push(url);
  }
  
  console.log(`📊 Total: ${formats.length} format(s) à tester`);
  console.log('==========================================\n');
  
  return formats;
}

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

// Schema pour la recherche de profils
const linkupSearchProfileSchema = z.object({
  name: z.string().optional(),
  job_title: z.string().optional(),
  connection_level: z.string().optional(),
  location: z.string().optional(),
  profile_url: z.string().optional(),
  profile_picture: z.string().nullable().optional(),
  invitation_state: z.string().optional(),
});

const linkupSearchProfilesResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    total_results: z.number().optional().default(0),
    total_available_results: z.number().optional().default(0),
    profiles: z.array(linkupSearchProfileSchema).optional().default([]),
    pagination: z.object({
      start_page: z.number(),
      end_page: z.number(),
      results_per_page: z.number(),
      pages_fetched: z.number(),
    }).optional(),
  }),
});

export type LinkupSearchProfile = z.infer<typeof linkupSearchProfileSchema>;

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
    console.log('\n🔍 ========== MAKE REQUEST - DÉBUT ==========');
    console.log('📍 Endpoint:', endpoint);
    console.log('🎭 Mode mock?', this.mockMode);
    
    if (this.mockMode) {
      console.log('⚠️ MODE MOCK ACTIF - Retour de données fictives');
      return this.getMockResponse(endpoint);
    }

    console.log('🔐 Vérification des credentials:');
    console.log('  - API Key présente?', !!this.apiKey);
    console.log('  - API Key longueur:', this.apiKey?.length || 0);
    console.log('  - Login Token présent?', !!this.loginToken);
    console.log('  - Login Token longueur:', this.loginToken?.length || 0);

    if (!this.loginToken) {
      console.error('❌ ERREUR: login_token manquant!');
      throw new Error('LinkedIn login_token is required. Please add LINKUP_LOGIN_TOKEN to your environment variables.');
    }

    const requestBody = {
      ...body,
      login_token: this.loginToken,
    };

    console.log('📦 Body complet à envoyer (login_token masqué):');
    const bodyToLog = { ...requestBody, login_token: `***${this.loginToken.slice(-6)}` };
    console.log(JSON.stringify(bodyToLog, null, 2));
    
    const fullUrl = `${LINKUP_API_BASE_URL}${endpoint}`;
    console.log('🌐 URL complète:', fullUrl);
    
    console.log('📤 Headers envoyés:');
    console.log('  - x-api-key:', `***${this.apiKey.slice(-6)}`);
    console.log('  - Content-Type: application/json');

    console.log('🚀 Envoi de la requête...');
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Réponse reçue:');
    console.log('  - Status:', response.status, response.statusText);
    console.log('  - OK?', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERREUR API LinkUp:');
      console.error('  - Endpoint:', endpoint);
      console.error('  - Status:', response.status, response.statusText);
      console.error('  - Body erreur:', errorText);
      console.error('  - URL utilisée:', fullUrl);
      console.error('  - Body envoyé:', JSON.stringify(bodyToLog, null, 2));
      throw new Error(`LinkUp API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Réponse API réussie:');
    console.log(JSON.stringify(data, null, 2));
    console.log('========== MAKE REQUEST - FIN ==========\n');
    return data;
  }

  private async makeSignalRequest(endpoint: string, body: any) {
    if (this.mockMode) {
      return this.getMockResponse(endpoint);
    }

    console.log(`\n🔍 LinkUp Signal API Request (${endpoint}):`);
    console.log('  Body:', JSON.stringify(body, null, 2));
    console.log('  Has API key:', !!this.apiKey);

    const response = await fetch(`${LINKUP_API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LinkUp Signal API error (${endpoint}):`, response.status, errorText);
      throw new Error(`LinkUp Signal API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ LinkUp Signal API response (${endpoint}):`, JSON.stringify(data, null, 2));
    return data;
  }

  private getMockResponse(endpoint: string) {
    if (endpoint.includes('/posts/reactions') || endpoint.includes('/data/signals/posts/reactions')) {
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

    if (endpoint.includes('/posts/extract-comments') || endpoint.includes('/data/signals/posts/comments')) {
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

    if (endpoint.includes('/profile/search')) {
      return {
        status: 'success',
        data: {
          total_results: 3,
          total_available_results: 125,
          profiles: [
            {
              name: 'Pierre Dubois',
              job_title: 'Directeur Commercial chez TechStart',
              connection_level: '2nd degree',
              location: 'Paris, Île-de-France',
              profile_url: 'https://linkedin.com/in/pierre-dubois-mock',
              profile_picture: 'https://via.placeholder.com/150',
              invitation_state: 'CAN_INVITE',
            },
            {
              name: 'Marie Laurent',
              job_title: 'CEO chez InnovCorp',
              connection_level: '3rd+ degree',
              location: 'Lyon, Auvergne-Rhône-Alpes',
              profile_url: 'https://linkedin.com/in/marie-laurent-mock',
              profile_picture: null,
              invitation_state: 'CAN_INVITE',
            },
            {
              name: 'Thomas Bernard',
              job_title: 'VP Sales chez CloudSolutions',
              connection_level: '2nd degree',
              location: 'Paris, Île-de-France',
              profile_url: 'https://linkedin.com/in/thomas-bernard-mock',
              profile_picture: 'https://via.placeholder.com/150',
              invitation_state: 'INVITATION_SENT',
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
    const cleanedUrl = cleanLinkedInUrl(postUrl);
    
    // ✅ Utiliser le Signal API pour les réactions (accepte ugcPost-)
    const reactionsResponse = await this.makeSignalRequest('/data/signals/posts/reactions', {
      post_url: cleanedUrl,
      total_results: totalResults,
      use_pagination: false,
    });

    // ✅ Utiliser le Signal API pour les commentaires (accepte ugcPost-)
    const commentsResponse = await this.makeSignalRequest('/data/signals/posts/comments', {
      post_url: cleanedUrl,
      total_results: totalResults,
      use_pagination: false,
    });

    const reactionsData = linkupReactionsResponseSchema.parse(reactionsResponse);
    const commentsData = linkupCommentsResponseSchema.parse(commentsResponse);

    // 🔍 LOGS DE COMPARAISON RÉACTIONS VS COMMENTAIRES
    console.log('\n========== ANALYSE ENDPOINT LINKEDIN ==========');
    console.log(`📊 RÉACTIONS (/posts/reactions): ${reactionsData.data.reactions.length} personnes`);
    console.log(`💬 COMMENTAIRES (/posts/extract-comments): ${commentsData.data.comments.length} personnes`);
    
    // Afficher les 5 premiers de chaque endpoint
    console.log('\n--- Aperçu RÉACTIONS (5 premiers) ---');
    reactionsData.data.reactions.slice(0, 5).forEach((r, i) => {
      console.log(`${i + 1}. ${r.name || 'Sans nom'} | Type: ${r.type || 'N/A'} | URL: ${r.profile_url || 'N/A'}`);
    });

    console.log('\n--- Aperçu COMMENTAIRES (5 premiers) ---');
    commentsData.data.comments.slice(0, 5).forEach((c, i) => {
      const name = c.commenter?.name || c.commenter_name || 'Sans nom';
      const url = c.commenter?.linkedin_url || c.commenter_profile_url || 'N/A';
      console.log(`${i + 1}. ${name} | URL: ${url}`);
    });

    // Vérifier si des commentateurs sont aussi dans les réactions
    const reactionUrls = new Set(reactionsData.data.reactions.map(r => r.profile_url).filter(Boolean));
    const commentUrls = commentsData.data.comments.map(c => 
      c.commenter?.linkedin_url || c.commenter_profile_url
    ).filter(Boolean);
    
    const overlap = commentUrls.filter(url => reactionUrls.has(url));
    console.log(`\n🔗 Personnes présentes dans les DEUX: ${overlap.length}/${commentUrls.length} commentateurs`);
    
    if (overlap.length > 0) {
      console.log('   → Certains commentateurs ont AUSSI réagi (présents dans les 2 endpoints)');
    } else if (commentUrls.length > 0) {
      console.log('   → Les commentateurs ne sont PAS dans les réactions (endpoints séparés)');
    }
    
    console.log('==============================================\n');

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

  async getPostComments(postUrl: string, totalResults: number = 50): Promise<LinkupComment[]> {
    const cleanedUrl = cleanLinkedInUrl(postUrl);
    
    console.log('🧹 URL Cleaning for getPostComments:', {
      original: postUrl,
      cleaned: cleanedUrl,
      changed: postUrl !== cleanedUrl
    });
    
    // ✅ Utiliser le Signal API qui accepte les URLs avec ugcPost-
    const commentsResponse = await this.makeSignalRequest('/data/signals/posts/comments', {
      post_url: cleanedUrl,
      total_results: totalResults,
      use_pagination: false,
    });

    const commentsData = linkupCommentsResponseSchema.parse(commentsResponse);
    return commentsData.data.comments;
  }

  async searchProfiles(params: {
    title?: string;
    location?: string;
    keyword?: string;
    company_url?: string;
    school_url?: string;
    network?: string;
    total_results?: number;
    start_page?: number;
  }): Promise<LinkupSearchProfile[]> {
    const searchResponse = await this.makeRequest('/profile/search', {
      title: params.title,
      location: params.location,
      keyword: params.keyword,
      company_url: params.company_url,
      school_url: params.school_url,
      network: params.network,
      total_results: params.total_results || 20,
      start_page: params.start_page,
      country: 'FR',
      fetch_invitation_state: true,
    });

    const searchData = linkupSearchProfilesResponseSchema.parse(searchResponse);
    
    console.log(`\n🔍 Profils trouvés: ${searchData.data.profiles.length}/${searchData.data.total_available_results} disponibles`);
    
    return searchData.data.profiles;
  }

  /**
   * Nouvelle API: Extraire les commentaires d'un post LinkedIn
   * Endpoint: POST /v1/posts/extract-comments
   * ✅ Requiert le login_token pour accéder aux commentaires
   * Coût: 1 crédit = 10 résultats
   */
  async extractComments(postUrl: string, totalResults: number = 10): Promise<LinkupComment[]> {
    console.log('\n🔍 ========== EXTRACT COMMENTS - DÉBUT ==========');
    console.log('📥 URL originale reçue:', postUrl);
    console.log('📊 Paramètres:', { totalResults, credits: Math.ceil(totalResults / 10) });
    
    const cleanedUrl = cleanLinkedInUrl(postUrl);
    console.log('🧹 URL après nettoyage:', cleanedUrl);
    
    // Générer plusieurs formats d'URL à tester
    const urlFormats = convertLinkedInPostUrl(cleanedUrl);
    
    console.log('🌐 Endpoint: /posts/extract-comments (AVEC login_token)');
    console.log(`🔄 ${urlFormats.length} format(s) d'URL à tester séquentiellement...`);

    const fullUrl = `${LINKUP_API_BASE_URL}/posts/extract-comments`;
    let lastError: any = null;
    
    // Tester chaque format jusqu'à ce que l'un fonctionne
    for (let i = 0; i < urlFormats.length; i++) {
      const testUrl = urlFormats[i];
      console.log(`\n🧪 Test ${i + 1}/${urlFormats.length}:`);
      console.log('  URL testée:', testUrl);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_url: testUrl,
            total_results: totalResults,
            country: 'FR',
            login_token: this.loginToken,
          }),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ SUCCÈS avec format ${i + 1}!`);
          console.log('📦 Réponse:', JSON.stringify(responseData, null, 2));

          const data = linkupCommentsResponseSchema.parse(responseData);
          console.log(`✅ ${data.data.comments.length} commentaires récupérés (${data.data.total_available_results} disponibles)`);
          console.log('========== EXTRACT COMMENTS - FIN ==========\n');
          
          return data.data.comments;
        } else {
          const errorText = await response.text();
          console.warn(`❌ Échec format ${i + 1}:`, response.status, errorText);
          lastError = new Error(`${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (error: any) {
        console.warn(`❌ Erreur format ${i + 1}:`, error.message);
        lastError = error;
      }
    }
    
    // Aucun format n'a fonctionné
    console.error('❌ TOUS LES FORMATS ONT ÉCHOUÉ');
    console.error('Formats testés:', urlFormats);
    throw new Error(`LinkUp API error: Aucun format d'URL accepté - ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Nouvelle API: Extraire les réactions d'un post LinkedIn
   * Endpoint: POST /v1/posts/reactions
   * ✅ Requiert le login_token pour accéder aux réactions
   * Coût: 1 crédit = 10 résultats
   */
  async extractReactions(postUrl: string, totalResults: number = 10): Promise<LinkupReaction[]> {
    console.log('\n🔍 ========== EXTRACT REACTIONS - DÉBUT ==========');
    console.log('📥 URL originale reçue:', postUrl);
    console.log('📊 Paramètres:', { totalResults, credits: Math.ceil(totalResults / 10) });
    
    const cleanedUrl = cleanLinkedInUrl(postUrl);
    console.log('🧹 URL après nettoyage:', cleanedUrl);
    
    // Générer plusieurs formats d'URL à tester
    const urlFormats = convertLinkedInPostUrl(cleanedUrl);
    
    console.log('🌐 Endpoint: /posts/reactions (AVEC login_token)');
    console.log(`🔄 ${urlFormats.length} format(s) d'URL à tester séquentiellement...`);

    const fullUrl = `${LINKUP_API_BASE_URL}/posts/reactions`;
    let lastError: any = null;
    
    // Tester chaque format jusqu'à ce que l'un fonctionne
    for (let i = 0; i < urlFormats.length; i++) {
      const testUrl = urlFormats[i];
      console.log(`\n🧪 Test ${i + 1}/${urlFormats.length}:`);
      console.log('  URL testée:', testUrl);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_url: testUrl,
            total_results: totalResults,
            country: 'FR',
            login_token: this.loginToken,
          }),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ SUCCÈS avec format ${i + 1}!`);
          console.log('📦 Réponse:', JSON.stringify(responseData, null, 2));

          const data = linkupReactionsResponseSchema.parse(responseData);
          console.log(`✅ ${data.data.reactions.length} réactions récupérées (${data.data.total_available_results} disponibles)`);
          console.log('========== EXTRACT REACTIONS - FIN ==========\n');
          
          return data.data.reactions;
        } else {
          const errorText = await response.text();
          console.warn(`❌ Échec format ${i + 1}:`, response.status, errorText);
          lastError = new Error(`${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (error: any) {
        console.warn(`❌ Erreur format ${i + 1}:`, error.message);
        lastError = error;
      }
    }
    
    // Aucun format n'a fonctionné
    console.error('❌ TOUS LES FORMATS ONT ÉCHOUÉ');
    console.error('Formats testés:', urlFormats);
    throw new Error(`LinkUp API error: Aucun format d'URL accepté - ${lastError?.message || 'Unknown error'}`);
  }
}

export async function getLinkupClient(teamId: number): Promise<LinkupClient> {
  console.log('\n🔍 ========== GET LINKUP CLIENT - DÉBUT ==========');
  console.log('🏢 Team ID:', teamId);
  
  const connection = await db.query.linkedinConnections.findFirst({
    where: eq(linkedinConnections.teamId, teamId),
  });

  console.log('🔍 Résultat de la requête DB:');
  console.log('  - Connexion trouvée?', !!connection);
  
  if (connection) {
    console.log('  - isActive?', connection.isActive);
    console.log('  - Login token présent?', !!connection.loginToken);
    console.log('  - Login token longueur:', connection.loginToken?.length || 0);
    console.log('  - Connecté le:', connection.connectedAt?.toISOString());
    console.log('  - Dernière utilisation:', connection.lastUsedAt?.toISOString());
    
    const daysSinceLastUse = connection.lastUsedAt 
      ? (Date.now() - connection.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
      : (connection.connectedAt ? (Date.now() - connection.connectedAt.getTime()) / (1000 * 60 * 60 * 24) : 999);
    
    console.log('  - Jours depuis dernière utilisation:', Math.round(daysSinceLastUse));
    
    if (daysSinceLastUse > 30) {
      console.warn('⚠️ ATTENTION: Token probablement expiré (>30 jours)');
    }
  }

  if (connection && connection.isActive) {
    console.log('✅ Connexion active - Mise à jour de lastUsedAt');
    await db
      .update(linkedinConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedinConnections.teamId, teamId));

    console.log('✅ Client LinkUp créé avec login_token');
    console.log('========== GET LINKUP CLIENT - FIN ==========\n');
    return new LinkupClient(undefined, connection.loginToken);
  }

  console.warn('⚠️ Aucune connexion active - Client en mode mock');
  console.log('========== GET LINKUP CLIENT - FIN ==========\n');
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

export async function fetchLinkedInProfile(profileUrl: string, teamId?: number): Promise<LinkupProfile> {
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

  let loginToken: string | undefined;
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
    console.error('LinkUp profile API error:', response.status, errorText);
    throw new Error(`LinkUp profile API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parsed = linkupProfileResponseSchema.parse(data);
  
  return parsed.data;
}
