'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { leads, prospectCandidates, icpProfiles, messages } from '@/lib/db/schema';
import { getLinkupClient, type LinkupPostEngagement } from '@/lib/integrations/linkup';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';

const importLeadsFromPostSchema = z.object({
  postUrl: z.string().url(),
  sourceMode: z.enum(['chaud', 'espion']),
  importMode: z.enum(['all', 'comments_only']).default('all'),
  teamId: z.string().transform(Number),
});

export const importLeadsFromPost = validatedActionWithUser(
  importLeadsFromPostSchema,
  async (data, _, user) => {
    const { postUrl, sourceMode, importMode, teamId } = data;

    // Décoder les entités HTML dans l'URL (ex: &amp; → &)
    const decodedPostUrl = postUrl
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    console.log('🔧 Import Configuration:');
    console.log('  Mode:', importMode);
    console.log('  URL:', decodedPostUrl);

    const linkupClient = await getLinkupClient(teamId);
    
    let reactions: any[] = [];
    let comments: any[] = [];

    // Mode "Tous" : appeler les 2 endpoints (réactions + commentaires)
    if (importMode === 'all') {
      const engagement = await linkupClient.getPostEngagement(decodedPostUrl);
      reactions = engagement.reactions;
      comments = engagement.comments;
      console.log(`✅ Mode ALL: ${reactions.length} réactions + ${comments.length} commentaires récupérés`);
    } 
    // Mode "Commentateurs uniquement" : appeler seulement l'endpoint des commentaires
    else if (importMode === 'comments_only') {
      const commentsData = await linkupClient.getPostComments(decodedPostUrl);
      comments = commentsData;
      console.log(`✅ Mode COMMENTS_ONLY: ${comments.length} commentaires récupérés (économie de 1 appel API)`);
    }

    const newProspects = [];
    let duplicatesSkipped = 0;

    // Traiter les réactions (seulement si mode "all")
    for (const reaction of reactions) {
      if (!reaction.profile_url) continue;

      const existingProspect = await db.query.prospectCandidates.findFirst({
        where: and(
          eq(prospectCandidates.profileUrl, reaction.profile_url),
          eq(prospectCandidates.teamId, teamId)
        ),
      });

      if (existingProspect) {
        duplicatesSkipped++;
        continue;
      }

      const { profile_picture, ...reactionWithoutPicture } = reaction;

      const [prospect] = await db.insert(prospectCandidates).values({
        teamId,
        source: 'linkedin_post',
        sourceRef: decodedPostUrl,
        action: 'reaction',
        postUrl: decodedPostUrl,
        reactionType: reaction.type,
        profileUrl: reaction.profile_url,
        actorUrn: reaction.actor_urn,
        name: reaction.name,
        title: reaction.subtitle,
        status: 'new',
        raw: reactionWithoutPicture,
      }).returning();

      newProspects.push(prospect);
    }

    // Traiter les commentaires
    for (const comment of comments) {
      const profileUrl = comment.commenter?.linkedin_url || comment.commenter_profile_url;
      const commenterName = comment.commenter?.name || comment.commenter_name || '';
      const commenterHeadline = comment.commenter?.occupation || comment.commenter_headline || '';
      
      if (!profileUrl) continue;

      const existingProspect = await db.query.prospectCandidates.findFirst({
        where: and(
          eq(prospectCandidates.profileUrl, profileUrl),
          eq(prospectCandidates.teamId, teamId)
        ),
      });

      if (existingProspect) {
        duplicatesSkipped++;
        continue;
      }

      const { commenter_profile_picture, ...commentWithoutPicture } = comment;
      if (commentWithoutPicture.commenter) {
        const { profile_picture, ...commenterWithoutPicture } = commentWithoutPicture.commenter;
        commentWithoutPicture.commenter = commenterWithoutPicture;
      }

      const [prospect] = await db.insert(prospectCandidates).values({
        teamId,
        source: 'linkedin_post',
        sourceRef: decodedPostUrl,
        action: 'comment',
        postUrl: decodedPostUrl,
        commentId: comment.comment_urn,
        commentText: comment.comment_text,
        profileUrl,
        name: commenterName,
        title: commenterHeadline,
        status: 'new',
        raw: commentWithoutPicture,
      }).returning();

      newProspects.push(prospect);
    }

    console.log(`✅ Import terminé: ${newProspects.length} nouveaux prospects, ${duplicatesSkipped} doublons évités`);

    return {
      success: true,
      count: newProspects.length,
      duplicatesSkipped,
      prospects: newProspects,
    };
  }
);

const enrichLeadSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
});

export const enrichLead = validatedActionWithUser(
  enrichLeadSchema,
  async (data, _, user) => {
    const { leadId, teamId } = data;

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
    });

    if (!lead || !lead.linkedinUrl) {
      return { success: false, error: 'Lead not found or missing LinkedIn URL' };
    }

    const linkupClient = await getLinkupClient(teamId);
    const profile = await linkupClient.getProfile(lead.linkedinUrl);

    const [updatedLead] = await db
      .update(leads)
      .set({
        firstName: profile.first_name || lead.firstName,
        lastName: profile.last_name || lead.lastName,
        title: profile.headline || lead.title,
        location: profile.location || lead.location,
        company: profile.current_company?.name || lead.company,
        companySize: profile.current_company?.size || lead.companySize,
        companyDomain: profile.current_company?.domain || lead.companyDomain,
        industry: profile.current_company?.industry || lead.industry,
        profilePictureUrl: profile.profile_picture_url || lead.profilePictureUrl,
        profileData: profile,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return {
      success: true,
      lead: updatedLead,
    };
  }
);

const searchLeadsSchema = z.object({
  teamId: z.number(),
  sourceMode: z.enum(['magnet', 'froid']).default('froid'),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  keywords: z.string().optional(),
});

export const searchColdLeads = validatedActionWithUser(
  searchLeadsSchema,
  async (data, _, user) => {
    const { teamId, sourceMode, ...filters } = data;

    const linkupClient = await getLinkupClient(teamId);
    const result = await linkupClient.searchProfiles(filters);

    const newLeads = [];

    for (const profile of result.profiles) {
      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.linkedinUrl, profile.profile_url),
          eq(leads.teamId, teamId)
        ),
      });

      if (existingLead) continue;

      const [lead] = await db.insert(leads).values({
        teamId,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        linkedinUrl: profile.profile_url,
        profilePictureUrl: profile.profile_picture_url,
        title: profile.headline,
        location: profile.location,
        company: profile.current_company?.name,
        companySize: profile.current_company?.size,
        companyDomain: profile.current_company?.domain,
        industry: profile.current_company?.industry,
        sourceMode,
        status: 'new',
        score: 0,
        profileData: profile,
      }).returning();

      newLeads.push(lead);
    }

    return {
      success: true,
      count: newLeads.length,
      total: result.total,
      leads: newLeads,
    };
  }
);

const updateLeadSchema = z.object({
  leadId: z.string().uuid(),
  teamId: z.number(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'lost']).optional(),
  score: z.number().optional(),
  scoreReason: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export const updateLead = validatedActionWithUser(
  updateLeadSchema,
  async (data, _, user) => {
    const { leadId, teamId, ...updates } = data;

    const [updatedLead] = await db
      .update(leads)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.teamId, teamId)))
      .returning();

    return {
      success: true,
      lead: updatedLead,
    };
  }
);

export async function getLeadsByTeam(teamId: number, sourceMode?: string) {
  const conditions = [eq(leads.teamId, teamId)];
  
  if (sourceMode) {
    conditions.push(eq(leads.sourceMode, sourceMode));
  }

  return db.query.leads.findMany({
    where: and(...conditions),
    orderBy: [desc(leads.createdAt)],
    limit: 100,
  });
}

export async function getLeadById(leadId: string, teamId: number) {
  return db.query.leads.findFirst({
    where: and(eq(leads.id, leadId), eq(leads.teamId, teamId)),
  });
}

const updateLeadStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'lost']),
});

export async function updateLeadStatus(formData: FormData) {
  const id = formData.get('id') as string;
  const status = formData.get('status') as 'new' | 'contacted' | 'replied' | 'qualified' | 'lost';

  const [updatedLead] = await db
    .update(leads)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();

  return updatedLead;
}

// Fonction pour générer une stratégie de recherche intelligente avec GPT
async function generateSearchStrategy(icp: any): Promise<Array<{
  level: string;
  title?: string;
  location?: string;
  keyword?: string;
}>> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `Tu es un expert en optimisation de recherche LinkedIn B2B. Ton rôle est de créer une stratégie de recherche progressive qui cible LES ENTREPRISES QUI PEUVENT ACHETER LE PRODUIT.

MISSION PRINCIPALE : Analyser le produit et générer des keywords de SECTEUR/INDUSTRIE pour cibler les bonnes entreprises dès la recherche.

RÈGLES ABSOLUES - UN SEUL CRITÈRE À LA FOIS :
1. Niveau 1 (ultra-ciblé) : UN métier + UN pays + Keywords de SECTEUR intelligents
2. Niveau 2 (ciblé) : UN métier + UN pays (sans keywords)  
3. Niveau 3 (large) : UN métier seul (garantit de trouver des profils)

STRATÉGIE KEYWORDS NIVEAU 1 :
- Analyser le produit pour identifier les SECTEURS/INDUSTRIES cibles
- Générer des keywords qui ciblent les ENTREPRISES qui achètent ce type de produit
- Exemples :
  * Produit "Solution IoT énergie bâtiments" → Keywords: "Real Estate Facility Management Property Energy"
  * Produit "CRM B2B SaaS" → Keywords: "Enterprise Software Sales Tech"
  * Produit "Cybersécurité cloud" → Keywords: "Finance Banking Healthcare Technology"

IMPORTANT :
- Choisir LE métier le plus important (un seul, pas de ";")
- Choisir LE pays principal (France en priorité)
- Keywords = SECTEURS où les entreprises peuvent acheter le produit

FORMAT DE SORTIE (JSON strict) :
{
  "strategies": [
    { "level": "1-ultra-ciblé", "title": "CTO", "location": "France", "keyword": "Real Estate Facility Management Energy" },
    { "level": "2-ciblé", "title": "CTO", "location": "France" },
    { "level": "3-large", "title": "CTO" }
  ]
}`;

  const userPrompt = `ICP à analyser :
- Métiers cibles : ${icp.buyerRoles || 'Non spécifié'}
- Localisation : ${icp.locations || 'Non spécifié'}
- Secteurs mentionnés : ${icp.industries || 'Non spécifié'}
- Mots-clés : ${icp.keywordsInclude || 'Non spécifié'}
${icp.problemStatement ? `- PRODUIT/SERVICE : ${icp.problemStatement}` : ''}

MISSION : Analyse le produit et génère des keywords de SECTEUR pour cibler les entreprises qui peuvent l'acheter.
Crée 3 niveaux de recherche progressifs.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.strategies || [];
  } catch (error) {
    console.error('❌ Erreur GPT pour stratégie de recherche:', error);
    // Fallback manuel si GPT échoue
    return generateManualStrategy(icp);
  }
}

// Fonction pour filtrer les entreprises pertinentes avec GPT
async function filterRelevantCompanies(
  profiles: any[],
  productDescription: string
): Promise<any[]> {
  if (!productDescription || profiles.length === 0) {
    return profiles; // Pas de filtrage si pas de description produit
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Extraire les noms d'entreprises uniques
  const companies = profiles
    .map(p => ({
      name: p.current_company?.name || 'N/A',
      profileUrl: p.profile_url,
    }))
    .filter(c => c.name !== 'N/A');

  if (companies.length === 0) {
    return profiles; // Pas d'entreprises à filtrer
  }

  const systemPrompt = `Tu es un expert en qualification de leads B2B. Ton rôle est d'identifier quelles entreprises peuvent être intéressées par un produit/service donné.

MISSION : Analyser rapidement une liste d'entreprises et déterminer lesquelles peuvent ACHETER le produit proposé.

CRITÈRES D'ÉVALUATION :
- Le secteur d'activité de l'entreprise est-il compatible avec le produit ?
- L'entreprise a-t-elle un besoin potentiel pour ce type de solution ?
- Est-ce un acheteur probable (pas juste théoriquement possible) ?

RÉPONSE STRICTE (JSON) :
{
  "relevant_companies": ["nom1", "nom2", ...]
}

Liste UNIQUEMENT les noms d'entreprises PERTINENTES (celles qui peuvent vraiment acheter).`;

  const userPrompt = `PRODUIT/SERVICE :
${productDescription}

ENTREPRISES À ANALYSER :
${companies.map(c => `- ${c.name}`).join('\n')}

Retourne uniquement les entreprises qui peuvent ACHETER ce produit.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"relevant_companies":[]}');
    const relevantNames = new Set(result.relevant_companies || []);

    console.log(`🎯 Filtrage GPT: ${relevantNames.size}/${companies.length} entreprises pertinentes`);
    console.log(`✅ Entreprises retenues:`, Array.from(relevantNames));

    // Filtrer les profils pour ne garder que ceux des entreprises pertinentes
    return profiles.filter(p => 
      relevantNames.has(p.current_company?.name) || !p.current_company?.name
    );
  } catch (error) {
    console.error('❌ Erreur filtrage GPT:', error);
    return profiles; // En cas d'erreur, retourner tous les profils
  }
}

// Fallback manuel si GPT échoue
function generateManualStrategy(icp: any) {
  const strategies = [];
  
  const roles = icp.buyerRoles?.split(',').map((r: string) => r.trim()).filter(Boolean) || [];
  const locs = icp.locations?.split(',').map((l: string) => l.trim()).filter(Boolean) || [];
  const industries = icp.industries?.split(',').map((i: string) => i.trim()).filter(Boolean) || [];
  const keywords = icp.keywordsInclude?.split(',').map((k: string) => k.trim()).filter(Boolean) || [];

  // Prendre UN SEUL métier et UN SEUL pays
  const mainRole = roles[0]; // Premier métier = le plus important
  const mainLocation = locs.find(l => l.toLowerCase().includes('france')) || locs[0]; // France en priorité

  // Niveau 1 : UN métier + UN pays + Keywords
  if (mainRole) {
    const level1: any = {
      level: '1-ultra-ciblé',
      title: mainRole,
    };
    if (mainLocation) level1.location = mainLocation;
    const allKeywords = [...keywords, ...industries].filter(Boolean);
    if (allKeywords.length > 0) level1.keyword = allKeywords.join(' ');
    
    strategies.push(level1);
  }

  // Niveau 2 : UN métier + UN pays (sans keywords)
  if (mainRole) {
    const level2: any = {
      level: '2-ciblé',
      title: mainRole,
    };
    if (mainLocation) level2.location = mainLocation;
    
    strategies.push(level2);
  }

  // Niveau 3 : SEULEMENT le métier principal
  if (mainRole) {
    strategies.push({
      level: '3-large',
      title: mainRole,
    });
  }

  return strategies;
}

const searchLeadsByICPSchema = z.object({
  icpId: z.coerce.number(),
  teamId: z.coerce.number(),
  totalResults: z.coerce.number().default(20),
});

export const searchLeadsByICP = validatedActionWithUser(
  searchLeadsByICPSchema,
  async (data, _, user) => {
    const { icpId, teamId, totalResults } = data;

    // Récupérer l'ICP
    const icp = await db.query.icpProfiles.findFirst({
      where: and(
        eq(icpProfiles.teamId, teamId),
        eq(icpProfiles.id, icpId)
      ),
    });

    if (!icp) {
      return { error: 'ICP not found', count: 0, prospects: [] };
    }

    // Calculer la page de départ en fonction de l'offset actuel
    const currentOffset = icp.lastSearchOffset || 0;
    const startPage = Math.floor(currentOffset / totalResults) + 1;
    
    console.log(`📄 Pagination: offset=${currentOffset}, page=${startPage}, total_results=${totalResults}`);

    // Générer la stratégie de recherche intelligente avec GPT
    console.log('🤖 Génération de la stratégie de recherche avec GPT...');
    const strategies = await generateSearchStrategy(icp);
    console.log('📋 Stratégies générées:', strategies);

    let profiles = [];
    let usedStrategy = null;

    // Essayer les stratégies progressivement jusqu'à trouver des profils
    const linkupClient = await getLinkupClient(teamId);
    
    for (const strategy of strategies) {
      // Créer les paramètres de recherche sans le champ "level"
      const { level, ...searchCriteria } = strategy;
      
      const searchParams: {
        total_results: number;
        start_page?: number;
        title?: string;
        location?: string;
        keyword?: string;
      } = {
        total_results: totalResults,
        start_page: startPage,
        ...searchCriteria,
      };

      // Supprimer les champs undefined
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key as keyof typeof searchParams] === undefined) {
          delete searchParams[key as keyof typeof searchParams];
        }
      });

      console.log(`🔍 Tentative ${level}:`, searchParams);

      try {
        // searchProfiles retourne directement un tableau de profils
        const allProfiles = await linkupClient.searchProfiles(searchParams);
        
        // IMPORTANT : Limiter au nombre demandé pour ne pas gaspiller les crédits
        profiles = allProfiles.slice(0, totalResults);
        console.log(`✅ ${profiles.length} profils trouvés avec ${level} (limité à ${totalResults} sur ${allProfiles.length} reçus)`);
        
        if (profiles.length > 0) {
          usedStrategy = level;
          break;
        }
      } catch (error) {
        console.error(`❌ Erreur avec stratégie ${level}:`, error);
      }
    }

    if (profiles.length === 0) {
      return { 
        error: 'Aucun profil trouvé même avec les critères élargis. Essayez de modifier votre ICP.', 
        count: 0, 
        prospects: [] 
      };
    }

    // Récupérer tous les prospects existants pour cette équipe en une seule requête
    const profileUrls = profiles.map(p => p.profile_url).filter(Boolean) as string[];
    const existingProspects = await db.query.prospectCandidates.findMany({
      where: and(
        eq(prospectCandidates.teamId, teamId),
        // Note: Drizzle ne supporte pas inArray directement ici, donc on filtre après
      ),
      columns: { profileUrl: true },
    });
    
    const existingUrls = new Set(existingProspects.map(p => p.profileUrl));
    const newProspects = [];

    // Insérer les profils dans prospect_candidates (seulement les nouveaux)
    for (const profile of profiles) {
      if (!profile.profile_url || existingUrls.has(profile.profile_url)) continue;

      const [prospect] = await db.insert(prospectCandidates).values({
        teamId,
        source: 'linkedin_search',
        sourceRef: icp.name,
        action: 'search',
        profileUrl: profile.profile_url,
        name: profile.name || 'N/A',
        title: profile.job_title || '',
        location: profile.location || '',
        connectionDegree: profile.connection_level || '',
        invitationState: profile.invitation_state || '',
        status: 'new',
        raw: profile,
      }).returning();

      newProspects.push({
        id: prospect.id,
        name: prospect.name,
        title: prospect.title,
        location: prospect.location,
        profileUrl: prospect.profileUrl,
        profilePictureUrl: (profile.profile_picture || '') as string,
      });
    }

    // Incrémenter l'offset pour la prochaine recherche (seulement si des profils ont été trouvés)
    if (profiles.length > 0) {
      const newOffset = currentOffset + profiles.length;
      await db
        .update(icpProfiles)
        .set({ 
          lastSearchOffset: newOffset,
          updatedAt: new Date() 
        })
        .where(eq(icpProfiles.id, icpId));
      
      console.log(`📊 Offset mis à jour: ${currentOffset} → ${newOffset} (prochaine page: ${Math.floor(newOffset / totalResults) + 1})`);
    }

    // Calculer la plage de profils importés
    const startRange = currentOffset + 1;
    const endRange = currentOffset + profiles.length;

    // Message sur la stratégie utilisée
    let strategyMessage = '';
    if (usedStrategy === '1-ultra-ciblé') {
      strategyMessage = ' (recherche ultra-ciblée)';
    } else if (usedStrategy === '2-ciblé') {
      strategyMessage = ' (critères élargis)';
    } else if (usedStrategy === '3-large') {
      strategyMessage = ' (recherche large - vérifiez la pertinence des profils)';
    }

    return {
      success: true,
      count: newProspects.length,
      prospects: newProspects,
      range: `${startRange}-${endRange}`,
      totalAvailable: profiles.length > 0 ? '1M+' : '0',
      strategyUsed: usedStrategy || 'manuel',
      strategyMessage,
    };
  }
);

const generateMessageSchema = z.object({
  leadId: z.string().uuid(),
});

interface MessageGenerationContext {
  leadName: string;
  leadTitle?: string;
  leadCompany?: string;
  leadLocation?: string;
  leadExperience?: string;
  productDescription?: string;
  companyContext?: string;
}

async function generatePersonalizedMessage(
  context: MessageGenerationContext
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `Tu es un expert en prospection B2B LinkedIn. Ta mission est de créer un message de prospection court, professionnel et personnalisé qui maximise les chances d'obtenir un RDV téléphonique.

RÈGLES STRICTES :
1. Maximum 150 mots (c'est court et percutant)
2. Tutoiement naturel français
3. Commencer par une accroche personnalisée basée sur le profil du prospect
4. Présenter rapidement la solution (1 phrase max)
5. Terminer par une proposition de RDV avec 2 créneaux concrets
6. Pas de formule de politesse trop longue
7. Ton professionnel mais accessible
8. Focus sur la VALEUR pour le prospect, pas sur nous

STRUCTURE RECOMMANDÉE :
1. Accroche personnalisée (observation du profil)
2. Lien rapide avec notre solution
3. Bénéfice concret pour leur contexte
4. Proposition de RDV avec créneaux
5. Signature courte`;

  const userPrompt = `Génère un message de prospection LinkedIn pour :

PROSPECT :
- Nom : ${context.leadName}
- Poste : ${context.leadTitle || 'Non spécifié'}
- Entreprise : ${context.leadCompany || 'Non spécifiée'}
${context.leadLocation ? `- Localisation : ${context.leadLocation}` : ''}
${context.leadExperience ? `- Contexte professionnel : ${context.leadExperience}` : ''}

NOTRE SOLUTION :
${context.productDescription || 'Solution SaaS B2B innovante'}

${context.companyContext ? `CONTEXTE SUPPLÉMENTAIRE :\n${context.companyContext}` : ''}

Crée un message COURT (max 150 mots), personnalisé et orienté RDV. Propose 2 créneaux concrets (exemple: "mardi 11h ou jeudi 15h").`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || '';
}

export const generateLeadMessage = validatedActionWithUser(
  generateMessageSchema,
  async (data, _, user) => {
    try {
      const teamMemberships = await db.query.teamMembers.findMany({
        where: (teamMembers, { eq }) => eq(teamMembers.userId, user.id),
        with: { team: true },
      });

      if (teamMemberships.length === 0) {
        return { success: false, error: 'Aucune équipe trouvée' };
      }

      const team = teamMemberships[0].team;

      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, data.leadId), eq(leads.teamId, team.id)),
      });

      if (!lead) {
        return { success: false, error: 'Lead non trouvé' };
      }

      const icp = await db.query.icpProfiles.findFirst({
        where: eq(icpProfiles.teamId, team.id),
      });

      let enrichedProfile: any = null;

      if (lead.profileData) {
        enrichedProfile = lead.profileData;
        console.log('✅ Utilisation des données de profil existantes (économie de crédits)');
      } else if (lead.linkedinUrl) {
        try {
          console.log('🔍 Enrichissement du profil via LinkUp API...');
          const linkupClient = await getLinkupClient(team.id);
          const profileData = await linkupClient.getProfile(lead.linkedinUrl);
          
          enrichedProfile = {
            name: profileData.name || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || undefined,
            headline: profileData.headline || lead.title || undefined,
            location: profileData.location || lead.location || undefined,
            industry: profileData.industry || lead.industry || undefined,
            experience: profileData.experience || [],
            education: profileData.education || [],
            skills: profileData.skills || [],
            summary: profileData.summary || undefined,
          };

          await db
            .update(leads)
            .set({ profileData: enrichedProfile as any })
            .where(eq(leads.id, lead.id));

          console.log('✅ Profil enrichi et sauvegardé');
        } catch (linkupError) {
          console.error('❌ Erreur LinkUp API:', linkupError);
          return { 
            success: false, 
            error: 'Impossible d\'enrichir le profil LinkedIn. Veuillez réessayer.' 
          };
        }
      }

      const leadName = enrichedProfile?.name || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Bonjour';
      const leadTitle = enrichedProfile?.headline || lead.title;
      const leadCompany = enrichedProfile?.experience?.[0]?.company || lead.company;
      const leadLocation = enrichedProfile?.location || lead.location;
      
      const experienceSummary = enrichedProfile?.experience
        ?.slice(0, 2)
        .map((exp: any) => `${exp.title || ''} ${exp.company ? `chez ${exp.company}` : ''}`.trim())
        .filter(Boolean)
        .join(', ');

      const context: MessageGenerationContext = {
        leadName,
        leadTitle,
        leadCompany,
        leadLocation,
        leadExperience: experienceSummary,
        productDescription: icp?.problemStatement || undefined,
        companyContext: icp?.idealCustomerExample || undefined,
      };

      let generatedMessage: string;
      try {
        generatedMessage = await generatePersonalizedMessage(context);
      } catch (openaiError) {
        console.error('❌ Erreur OpenAI API:', openaiError);
        return { 
          success: false, 
          error: 'Impossible de générer le message. Veuillez vérifier votre clé API OpenAI.' 
        };
      }

      const [savedMessage] = await db
        .insert(messages)
        .values({
          teamId: team.id,
          leadId: lead.id,
          messageText: generatedMessage,
          status: 'draft',
          channel: 'linkedin',
        })
        .returning();

      await db
        .update(leads)
        .set({ lastContactedAt: new Date() })
        .where(eq(leads.id, lead.id));

      const { revalidatePath } = await import('next/cache');
      revalidatePath('/dashboard/leads');
      revalidatePath(`/dashboard/leads/${lead.id}`);

      return {
        success: true,
        message: generatedMessage,
        messageId: savedMessage.id,
      };
    } catch (error) {
      console.error('❌ Erreur inattendue lors de la génération du message:', error);
      return { 
        success: false, 
        error: 'Une erreur inattendue est survenue. Veuillez réessayer.' 
      };
    }
  }
);
