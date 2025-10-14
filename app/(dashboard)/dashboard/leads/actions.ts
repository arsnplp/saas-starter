'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { leads, prospectCandidates, icpProfiles, messages } from '@/lib/db/schema';
import { getLinkupClient, type LinkupPostEngagement } from '@/lib/integrations/linkup';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';

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
    
    // Normaliser la réponse (peut être un tableau ou un objet {profiles, total})
    let profiles: any[];
    let total: number;
    
    if (Array.isArray(result)) {
      profiles = result;
      total = result.length;
    } else {
      profiles = (result as any).profiles || [];
      total = (result as any).total || 0;
    }

    const newLeads = [];

    for (const profile of profiles) {
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
      total,
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

// Fonction utilitaire pour extraire le nom d'entreprise depuis le job_title
function extractCompanyFromJobTitle(jobTitle: string): string | null {
  if (!jobTitle) return null;
  
  // Patterns : "CTO at Alcatel", "CTO chez Vinci", "CTO @ Schneider"
  const patterns = [
    / at ([^|,]+)/i,
    / chez ([^|,]+)/i,
    / @ ([^|,]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = jobTitle.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Fonction pour filtrer les profils valides et les entreprises pertinentes avec GPT
async function filterRelevantCompanies(
  profiles: any[],
  productDescription: string
): Promise<any[]> {
  // Étape 1 : Filtrer les profils INVALIDES (URLs de recherche, profils cachés)
  const validProfiles = profiles.filter(p => {
    // Vérifier que ce n'est pas un profil caché
    if (p.name === 'Utilisateur LinkedIn' || p.name?.includes('Utilisateur LinkedIn')) {
      return false;
    }
    // Vérifier que l'URL est valide (pas une URL de recherche)
    if (p.profile_url?.includes('/search/results/') || p.profile_url?.includes('headless?')) {
      return false;
    }
    // Vérifier qu'on peut extraire une entreprise du job_title
    const company = extractCompanyFromJobTitle(p.job_title || '');
    if (!company) {
      return false;
    }
    return true;
  });

  console.log(`🧹 Filtrage URLs invalides: ${validProfiles.length}/${profiles.length} profils valides`);

  if (validProfiles.length === 0) {
    return [];
  }

  if (!productDescription) {
    return validProfiles; // Pas de filtrage par entreprise si pas de description produit
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Extraire les entreprises uniques depuis job_title
  const companiesMap = new Map();
  validProfiles.forEach(p => {
    const company = extractCompanyFromJobTitle(p.job_title || '');
    if (company && !companiesMap.has(company)) {
      companiesMap.set(company, {
        name: company,
        // Pas d'info industrie/size pour recherche froide
        industry: 'À déterminer',
        size: 'À déterminer',
        domain: '',
      });
    }
  });
  
  const companies = Array.from(companiesMap.values());

  const systemPrompt = `Tu es un COMMERCIAL B2B EXPERT avec 15 ans d'expérience. Ton rôle : analyser si une entreprise pourrait acheter un produit donné, EN UTILISANT uniquement leur NOM.

MÉTHODOLOGIE (comme un vrai commercial) :
1. Analyser le NOM de l'entreprise pour deviner son secteur d'activité
2. Utiliser ta connaissance générale des grandes entreprises (Schneider = énergie, Vinci = BTP, etc.)
3. Identifier si ce secteur a BESOIN du produit proposé
4. Décider : OUI (prospect chaud) ou NON (pas pertinent)

RÈGLES DE QUALIFICATION :
✅ ACCEPTER si : Le nom suggère un secteur compatible avec le produit
❌ REJETER si : Le nom suggère un secteur sans lien avec le produit
⚠️ Être SÉLECTIF : Mieux vaut 3 prospects parfaits que 10 moyens
⚠️ Si tu ne connais pas l'entreprise, ACCEPTE-la (principe de précaution)

RÉPONSE JSON :
{
  "relevant_companies": ["nom_exact_1", "nom_exact_2", ...],
  "reasoning": "Explication rapide des choix"
}

IMPORTANT : Retourne les noms EXACTS (copier-coller).`;

  const userPrompt = `PRODUIT/SERVICE À VENDRE :
${productDescription}

ENTREPRISES À QUALIFIER (seulement par leur nom) :
${companies.map(c => `- ${c.name}`).join('\n')}

MISSION : Analyse chaque entreprise comme un commercial.
Utilise ta connaissance du marché pour identifier leur secteur probable.
Retourne UNIQUEMENT les entreprises qui pourraient acheter ce produit.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"relevant_companies":[], "reasoning":""}');
    const relevantNames = new Set(result.relevant_companies || []);

    console.log(`🎯 Analyse commerciale GPT: ${relevantNames.size}/${companies.length} entreprises qualifiées`);
    console.log(`💡 Raisonnement GPT: ${result.reasoning}`);
    console.log(`✅ Entreprises retenues:`, Array.from(relevantNames));
    console.log(`❌ Entreprises rejetées:`, companies.filter(c => !relevantNames.has(c.name)).map(c => c.name));

    // Filtrer les profils pour ne garder QUE ceux des entreprises pertinentes
    const filtered = validProfiles.filter(p => {
      const company = extractCompanyFromJobTitle(p.job_title || '');
      return company && relevantNames.has(company);
    });
    
    console.log(`📊 Résultat final: ${filtered.length} profils avec entreprises qualifiées`);
    
    return filtered;
  } catch (error) {
    console.error('❌ Erreur analyse GPT:', error);
    return validProfiles; // En cas d'erreur, retourner les profils valides (sans invalides)
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

// Interface pour les entreprises avec URL LinkedIn
interface TargetCompany {
  name: string;
  linkedinUrl: string | null;
}

// Fonction pour générer des noms d'entreprises cibles avec GPT
async function generateTargetCompanies(icp: any, previousCompanies: string[] = []): Promise<TargetCompany[]> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Tu es un expert en génération de leads B2B. Ta mission : identifier des entreprises qui sont des CLIENTS FINAUX (utilisateurs directs du produit), PAS des partenaires, revendeurs ou intégrateurs.

🎯 PRODUIT/SERVICE À VENDRE:
${icp.problemStatement || 'Non spécifié'}

👤 EXEMPLE DE CLIENT IDÉAL (pour calibrer ton ciblage):
${icp.idealCustomerExample || 'Non spécifié'}

📊 CRITÈRES ICP:
- Secteurs d'activité: ${icp.industries || 'Non spécifié'}
- Localisation géographique: ${icp.locations || 'Non spécifié'}
- Taille d'entreprise: ${icp.companySizeMin || '0'} - ${icp.companySizeMax || 'illimité'} employés
- Mots-clés pertinents: ${icp.keywordsInclude || 'Non spécifié'}
${icp.keywordsExclude ? `- Mots-clés à EXCLURE: ${icp.keywordsExclude}` : ''}

${previousCompanies.length > 0 ? `⛔ ENTREPRISES DÉJÀ SUGGÉRÉES (ne PAS les proposer à nouveau): ${previousCompanies.join(', ')}` : ''}

🚨 RÈGLES CRITIQUES - CLIENT FINAL vs PARTENAIRE:

✅ CHERCHE des entreprises qui vont ACHETER et UTILISER ce produit au quotidien:
   - Elles ont le problème que le produit résout
   - Elles vont consommer le service/produit en interne
   - Ce sont les utilisateurs finaux (end-users)

❌ EXCLUS ABSOLUMENT ces types d'entreprises (ce ne sont PAS des clients finaux):
   - SSII / ESN / Agences de développement / Intégrateurs
   - Cabinets de conseil / Consultants
   - Agences digitales / Agences marketing
   - Éditeurs de logiciels concurrents
   - Revendeurs / Distributeurs / Partenaires technologiques
   - Toute entreprise qui VENDRAIT ce produit plutôt que de l'UTILISER

💡 EXEMPLES SELON L'INDUSTRIE (pour t'aider à comprendre):

Si le produit = "Gestion énergétique de bâtiments":
✅ OUI: Gestionnaires immobiliers (Nexity, Foncia), Hôpitaux (AP-HP), Hôtels (Accor), Universités (Sorbonne)
❌ NON: Sopra Steria (SSII), Capgemini (conseil), Schneider Electric (concurrent)

Si le produit = "CRM pour commerciaux":
✅ OUI: Entreprises avec équipes commerciales (PME industrielles, startups SaaS)
❌ NON: Agences web, consultants Salesforce, intégrateurs

Si le produit = "Logiciel RH":
✅ OUI: Entreprises avec des RH (grands groupes, PME, administrations)
❌ NON: Éditeurs RH concurrents, SSII spécialisées RH

🔍 MÉTHODE DE SÉLECTION:

1. **Analyse le problème** : Comprends QUI a vraiment ce problème dans la vraie vie
2. **Identifie le décideur** : Qui va signer le chèque pour acheter ce produit ?
3. **Pense à l'usage quotidien** : Qui va ouvrir l'application tous les jours ?
4. **Vérifie l'alignement** : Cette entreprise correspond-elle à l'exemple de client idéal fourni ?
5. **Double-check** : "Cette entreprise va-t-elle UTILISER ou REVENDRE le produit ?" → Si REVENDRE, EXCLURE !

📋 FORMAT DE RÉPONSE:

IMPORTANT: Tu DOIS retourner un objet JSON valide avec ce format exact:

{
  "companies": [
    {"name": "Doctolib", "linkedin_url": "linkedin.com/company/doctolib"},
    {"name": "360Learning", "linkedin_url": "linkedin.com/company/360learning"},
    {"name": "Swile", "linkedin_url": "linkedin.com/company/swile"}
  ]
}

RÈGLES JSON:
- L'URL LinkedIn doit être au format: linkedin.com/company/nom-entreprise (sans https://)
- Si tu ne connais PAS l'URL LinkedIn, mets null: {"name": "Entreprise", "linkedin_url": null}
- Retourne 10-15 entreprises RÉELLES qui existent vraiment
- Varie les tailles (startups, PME, grands groupes) selon les critères ICP
- Privilégie les entreprises de la localisation spécifiée
- Les noms d'entreprises avec chiffres sont autorisés: "360Learning", "3M", "21st Century Fox"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // Un peu de créativité pour varier les suggestions
      response_format: { type: "json_object" }, // Force GPT à retourner du JSON valide
    });

    const response = completion.choices[0].message.content?.trim() || '';
    
    let companiesData: TargetCompany[] = [];
    
    try {
      // 🎯 MÉTHODE PRINCIPALE: Parser le JSON structuré (robuste et fiable)
      const jsonData = JSON.parse(response);
      
      if (jsonData.companies && Array.isArray(jsonData.companies)) {
        companiesData = jsonData.companies
          .filter((c: any) => c.name && typeof c.name === 'string')
          .map((c: any) => ({
            name: c.name.trim(),
            linkedinUrl: c.linkedin_url && typeof c.linkedin_url === 'string' ? c.linkedin_url.trim() : null
          }))
          .slice(0, 15); // Max 15 entreprises
        
        console.log(`✅ JSON parsing réussi: ${companiesData.length} entreprises parsées`);
      } else {
        throw new Error('Format JSON invalide: "companies" array manquant');
      }
    } catch (parseError) {
      // 🔄 FALLBACK: Si JSON invalide, utiliser l'ancien parsing texte (compatibilité)
      console.warn('⚠️ JSON parsing échoué, fallback sur parsing texte:', parseError);
      
      companiesData = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 1)
        .map(line => {
          // Retirer les préfixes de liste
          let cleanedLine = line;
          cleanedLine = cleanedLine.replace(/^-\s+/, '');
          cleanedLine = cleanedLine.replace(/^\*\s+/, '');
          cleanedLine = cleanedLine.replace(/^#\s+/, '');
          cleanedLine = cleanedLine.replace(/^[\u2022\u2023\u25E6]\s+/, '');
          cleanedLine = cleanedLine.replace(/^\d+[\.)]\s+/, '');
          cleanedLine = cleanedLine.replace(/^\d+\s*-\s+/, '');
          cleanedLine = cleanedLine.trim();
          
          // Format: "Klepierre|linkedin.com/company/klepierre"
          const parts = cleanedLine.split('|');
          return {
            name: parts[0].trim(),
            linkedinUrl: parts[1] ? parts[1].trim() : null
          };
        })
        .filter(c => c.name.length > 0)
        .slice(0, 15);
      
      console.log(`🔄 Fallback parsing réussi: ${companiesData.length} entreprises`);
    }

    console.log(`🏢 GPT a généré ${companiesData.length} entreprises CLIENTES FINALES:`, companiesData);
    
    return companiesData;
  } catch (error) {
    console.error('❌ Erreur génération entreprises GPT:', error);
    return []; // Retourner tableau vide en cas d'erreur
  }
}

const searchLeadsByICPSchema = z.object({
  icpId: z.coerce.number(),
  teamId: z.coerce.number(),
  totalResults: z.coerce.number().default(10), // 10 profils = 1 crédit LinkUp
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

    console.log('🎯 NOUVELLE APPROCHE: Génération d\'entreprises cibles avec GPT');
    
    // Récupérer les entreprises déjà suggérées
    const previousCompanies = (icp.suggestedCompanies as string[]) || [];
    console.log(`📋 Entreprises déjà suggérées (${previousCompanies.length}):`, previousCompanies);
    
    // Générer de nouvelles entreprises cibles avec GPT
    const targetCompanies = await generateTargetCompanies(icp, previousCompanies);
    
    if (targetCompanies.length === 0) {
      return {
        error: 'Impossible de générer des entreprises cibles. Vérifiez votre ICP.',
        count: 0,
        prospects: []
      };
    }
    
    console.log(`🏢 ${targetCompanies.length} nouvelles entreprises cibles générées`);
    
    // Mettre à jour la liste des entreprises suggérées (stocker juste les noms)
    const allSuggestedCompanies = [...previousCompanies, ...targetCompanies.map(c => c.name)];
    await db
      .update(icpProfiles)
      .set({ 
        suggestedCompanies: allSuggestedCompanies,
        updatedAt: new Date() 
      })
      .where(eq(icpProfiles.id, icpId));
    
    // Déterminer le rôle principal à rechercher
    const roles = icp.buyerRoles?.split(',').map((r: string) => r.trim()).filter(Boolean) || [];
    const mainRole = roles[0] || 'CTO'; // Par défaut CTO
    
    const linkupClient = await getLinkupClient(teamId);
    const collectedProfiles: any[] = [];
    let totalProfilesTried = 0;
    const MAX_PROFILES = 50; // Limite max = 5 crédits
    const TARGET_COUNT = 10; // Objectif : 10 profils
    
    console.log(`🔍 Recherche de profils "${mainRole}" dans les entreprises cibles...`);
    
    // Pour chaque entreprise, chercher des profils
    for (const company of targetCompanies) {
      if (collectedProfiles.length >= TARGET_COUNT || totalProfilesTried >= MAX_PROFILES) {
        break; // On a atteint l'objectif ou la limite
      }
      
      try {
        console.log(`\n🏢 Recherche dans: ${company.name}${company.linkedinUrl ? ` (${company.linkedinUrl})` : ''}`);
        
        // Chercher des profils avec filtrage par entreprise si URL disponible
        const searchParams: any = {
          total_results: 5, // 5 profils par entreprise max
        };
        
        if (company.linkedinUrl) {
          // ✅ Filtrage précis avec company_url (garantit bonne entreprise)
          searchParams.title = mainRole;
          searchParams.company_url = company.linkedinUrl;
          console.log(`  🎯 Filtrage précis: title="${mainRole}" + company_url="${company.linkedinUrl}"`);
        } else {
          // ⚠️ Fallback: recherche par keyword (moins précis)
          searchParams.keyword = `${mainRole} ${company.name}`;
          console.log(`  ⚠️ Fallback keyword: "${searchParams.keyword}" (URL LinkedIn inconnue)`);
        }
        
        const result = await linkupClient.searchProfiles(searchParams);
        
        // Normaliser la réponse (peut être un tableau ou un objet {profiles, total})
        let profiles: any[];
        if (Array.isArray(result)) {
          profiles = result;
        } else {
          profiles = (result as any).profiles || [];
        }
        
        if (profiles.length === 0) {
          console.log(`  ⚠️ Aucun profil trouvé`);
          continue;
        }
        
        // Filtrer les URLs invalides
        const validProfiles = profiles.filter((p: any) => 
          p.profile_url && 
          !p.profile_url.includes('/search/results/') && 
          !p.profile_url.includes('headless?') &&
          p.name !== 'Utilisateur LinkedIn'
        );
        
        console.log(`  ✅ ${validProfiles.length} profils valides trouvés`);
        
        totalProfilesTried += profiles.length;
        collectedProfiles.push(...validProfiles);
        
        // Si on a atteint l'objectif, arrêter
        if (collectedProfiles.length >= TARGET_COUNT) {
          console.log(`\n✅ Objectif atteint : ${collectedProfiles.length} profils collectés`);
          break;
        }
      } catch (error) {
        console.error(`  ❌ Erreur recherche ${company}:`, error);
      }
    }
    
    // Limiter à 10 profils finaux
    const profiles = collectedProfiles.slice(0, TARGET_COUNT);
    const creditsUsed = Math.min(Math.ceil(totalProfilesTried / 10), 5);
    
    console.log(`\n💰 Coût total: ${creditsUsed} crédit(s) pour ${profiles.length} profils`);
    
    if (profiles.length === 0) {
      return { 
        error: 'Aucun profil trouvé dans les entreprises cibles. Réessayez pour générer de nouvelles entreprises.', 
        count: 0, 
        prospects: [],
        creditsUsed 
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

    console.log(`\n📊 Résultat final: ${newProspects.length} nouveaux prospects sur ${profiles.length} trouvés`);
    
    return {
      success: true,
      count: newProspects.length,
      prospects: newProspects,
      companiesUsed: targetCompanies.join(', '),
      creditsUsed, // Nombre de crédits LinkUp utilisés
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
