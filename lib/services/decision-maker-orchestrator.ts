import { db } from '@/lib/db/drizzle';
import { decisionMakers, targetCompanies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  searchLinkedInProfiles,
  type LinkUpProfileSearchResult,
} from '@/lib/integrations/linkup';
import { enrichContactInfo, type EnrichmentTarget } from './contact-enrichment';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TARGET_TITLES = [
  'CTO',
  'Chief Technology Officer',
  'Head of Innovation',
  'VP Operations',
  'Directeur Technique',
  'Directeur Innovation',
  'Directeur des Opérations',
  'Facility Manager',
  'Energy Manager',
  'Directeur Général',
  'CEO',
  'COO',
  'Directeur',
];

interface DecisionMakerCandidate {
  name: string;
  title: string;
  linkedinUrl?: string;
  profilePictureUrl?: string;
  location?: string;
  relevanceScore: number;
  reasoning: string;
  email?: string;
  phone?: string;
  source: 'linkup' | 'web_search';
}

async function scoreProfileRelevance(
  profile: { name: string; title: string; location?: string },
  companyName: string
): Promise<{ score: number; reasoning: string }> {
  const prompt = `Tu es un expert en identification de décideurs dans le domaine de l'efficacité énergétique et du numérique responsable.

Entreprise cible: ${companyName}

Profil à évaluer:
- Nom: ${profile.name}
- Poste: ${profile.title || 'Non renseigné'}
- Localisation: ${profile.location || 'Non renseignée'}

Score ce profil de 0 à 100 selon sa pertinence comme décideur potentiel pour une solution d'optimisation énergétique et de numérique responsable.

Critères de scoring:
- Niveau hiérarchique (CTO, CEO, Directeur > Manager > Responsable)
- Lien avec la technologie, l'innovation, les opérations ou l'énergie
- Pouvoir de décision sur les budgets et investissements
- Pertinence du poste pour les enjeux énergétiques/numériques

Réponds UNIQUEMENT au format JSON strict suivant:
{
  "score": <nombre entre 0 et 100>,
  "reasoning": "<explication courte en 1-2 phrases>"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en identification de décideurs B2B. Tu réponds toujours en JSON valide.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return { score: 0, reasoning: 'Pas de réponse GPT' };
    }

    const result = JSON.parse(content);
    return {
      score: result.score || 0,
      reasoning: result.reasoning || 'Aucune explication fournie',
    };
  } catch (error) {
    console.error('❌ Erreur lors du scoring GPT:', error);
    return {
      score: 0,
      reasoning: 'Erreur lors de l\'analyse',
    };
  }
}

async function searchViaLinkUp(params: {
  companyLinkedInUrl: string;
  companyName: string;
  teamId: number;
}): Promise<DecisionMakerCandidate[]> {
  const { companyLinkedInUrl, companyName, teamId } = params;
  const candidates: DecisionMakerCandidate[] = [];

  console.log(`\n🔵 === RECHERCHE VIA LINKUP ===`);

  for (const title of TARGET_TITLES) {
    try {
      console.log(`🎯 Recherche: ${title} @ ${companyName}`);

      const profiles = await searchLinkedInProfiles({
        companyUrl: companyLinkedInUrl,
        title,
        totalResults: 3,
        teamId,
      });

      console.log(`   Profils trouvés: ${profiles.length}`);

      for (const profile of profiles) {
        if (candidates.some((c) => c.linkedinUrl === profile.profile_url)) {
          console.log(`   ⏭️  Profil déjà ajouté: ${profile.name}`);
          continue;
        }

        const { score, reasoning } = await scoreProfileRelevance(
          {
            name: profile.name,
            title: profile.job_title || '',
            location: profile.location || undefined,
          },
          companyName
        );

        console.log(`   📊 ${profile.name}: ${score}/100 - ${reasoning}`);

        if (score >= 60) {
          candidates.push({
            name: profile.name,
            title: profile.job_title || 'Poste non renseigné',
            linkedinUrl: profile.profile_url,
            profilePictureUrl: profile.profile_picture || undefined,
            location: profile.location || undefined,
            relevanceScore: score,
            reasoning,
            source: 'linkup',
          });
          console.log(`   ✅ Candidat ajouté (score: ${score})`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur pour le titre "${title}":`, error);
    }
  }

  console.log(`✅ LinkUp: ${candidates.length} candidats trouvés`);
  return candidates;
}

async function searchViaWeb(params: {
  companyName: string;
  companyLinkedInUrl: string;
  companyWebsite?: string;
}): Promise<DecisionMakerCandidate[]> {
  const { companyName, companyLinkedInUrl, companyWebsite } = params;

  console.log(`\n🟢 === RECHERCHE VIA WEB ===`);

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    console.log('❌ TAVILY_API_KEY non disponible');
    return [];
  }

  const titleQuery = TARGET_TITLES.slice(0, 5).join(' OR ');
  const searchQuery = `"${companyName}" ${titleQuery} directeur responsable décideur`;

  console.log(`📡 Recherche web: ${searchQuery}`);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        max_results: 5,
        include_raw_content: true,
      }),
    });

    if (!response.ok) {
      console.log(`❌ Erreur Tavily: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('⚠️ Aucun résultat web');
      return [];
    }

    const combinedContent = results
      .map((r: any) => r.content || r.raw_content || '')
      .join('\n\n')
      .slice(0, 6000);

    console.log(`🤖 Analyse GPT des résultats web...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en identification de décideurs B2B. Analyse le contenu web fourni et identifie TOUS les décideurs et personnes clés mentionnés pour l'entreprise "${companyName}".

**POSTES RECHERCHÉS (prioriser ces titres):**
- Direction générale: CEO, Président, Directeur Général, PDG
- Direction technique: CTO, DSI, Directeur Technique, Directeur Informatique  
- Direction innovation: CDO, Directeur Innovation, Directeur Transformation
- Direction opérationnelle: COO, Directeur Opérations, Directeur Général Délégué
- Autres directions: DRH, DAF, Directeur Commercial, VP, etc.

**INSTRUCTIONS:**
1. Cherche les NOMS COMPLETS (prénom + nom) des personnes mentionnées
2. Identifie leur TITRE/POSTE exact
3. Inclus même si le titre est approximatif (ex: "Responsable", "Manager", etc.) - on filtrera après
4. Si tu trouves plusieurs personnes, retourne-les TOUTES
5. Même si le texte est court, extrais toute personne mentionnée avec un rôle de décision

**FORMAT DE RÉPONSE (JSON STRICT):**
{
  "contacts": [
    {
      "name": "Prénom Nom",
      "title": "Titre exact du poste"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`,
        },
        {
          role: 'user',
          content: `Entreprise cible: ${companyName}\n\nRésultats web à analyser:\n${combinedContent}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    const contacts = result.contacts || [];

    console.log(`   → ${contacts.length} contacts identifiés par GPT`);

    const candidates: DecisionMakerCandidate[] = [];

    for (const contact of contacts) {
      const { score, reasoning } = await scoreProfileRelevance(
        { name: contact.name, title: contact.title },
        companyName
      );

      if (score >= 60) {
        candidates.push({
          name: contact.name,
          title: contact.title,
          relevanceScore: score,
          reasoning,
          source: 'web_search',
        });
        console.log(`   ✅ ${contact.name} - Score: ${score}/100`);
      } else {
        console.log(`   ⏭️  ${contact.name} - Score trop faible: ${score}/100`);
      }
    }

    console.log(`✅ Web: ${candidates.length} candidats qualifiés`);
    return candidates;
  } catch (error) {
    console.error('❌ Erreur recherche web:', error);
    return [];
  }
}

async function findLinkedInProfile(params: {
  name: string;
  companyName: string;
}): Promise<string | null> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) return null;

  try {
    console.log(`   🔍 Recherche profil LinkedIn: ${params.name}`);

    const searchQuery = `site:linkedin.com/in "${params.name}" "${params.companyName}"`;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        max_results: 3,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results || [];

    for (const result of results) {
      const url = result.url || '';
      if (url.includes('linkedin.com/in/')) {
        const cleanUrl = url.split('?')[0];
        console.log(`   ✅ Profil trouvé: ${cleanUrl}`);
        return cleanUrl;
      }
    }

    console.log(`   ⚠️ Profil LinkedIn non trouvé`);
    return null;
  } catch (error) {
    console.error(`   ❌ Erreur recherche profil:`, error);
    return null;
  }
}

export async function findAndEnrichDecisionMakers(params: {
  companyId: string;
  teamId: number;
}): Promise<{ success: boolean; count: number }> {
  const { companyId, teamId } = params;

  console.log(`\n🎯 === DÉCOUVERTE UNIFIÉE DE DÉCIDEURS ===`);
  console.log(`Entreprise: ${companyId}`);
  console.log(`Équipe: ${teamId}`);

  const company = await db.query.targetCompanies.findFirst({
    where: and(
      eq(targetCompanies.id, companyId),
      eq(targetCompanies.teamId, teamId)
    ),
  });

  if (!company) {
    throw new Error('Entreprise non trouvée');
  }

  console.log(`📌 ${company.name}`);
  console.log(`🔗 LinkedIn: ${company.linkedinUrl || 'Non renseigné'}`);

  let allCandidates: DecisionMakerCandidate[] = [];

  if (company.linkedinUrl) {
    try {
      const linkupCandidates = await searchViaLinkUp({
        companyLinkedInUrl: company.linkedinUrl,
        companyName: company.name,
        teamId,
      });
      allCandidates = [...allCandidates, ...linkupCandidates];
    } catch (error: any) {
      console.log(`⚠️ LinkUp échoué (${error.message}), basculement vers web`);
    }
  }

  if (allCandidates.length === 0) {
    const webCandidates = await searchViaWeb({
      companyName: company.name,
      companyLinkedInUrl: company.linkedinUrl || '',
      companyWebsite: company.website || undefined,
    });
    allCandidates = [...allCandidates, ...webCandidates];
  }

  console.log(`\n📊 Total: ${allCandidates.length} candidats avant déduplication`);

  const deduplicatedMap = new Map<string, DecisionMakerCandidate>();

  for (const candidate of allCandidates) {
    const normalizedName = candidate.name.toLowerCase().trim();
    
    const existing = deduplicatedMap.get(normalizedName);
    
    if (!existing) {
      deduplicatedMap.set(normalizedName, candidate);
    } else {
      if (candidate.linkedinUrl && !existing.linkedinUrl) {
        deduplicatedMap.set(normalizedName, { ...existing, linkedinUrl: candidate.linkedinUrl, profilePictureUrl: candidate.profilePictureUrl });
      }
      if (candidate.profilePictureUrl && !existing.profilePictureUrl) {
        existing.profilePictureUrl = candidate.profilePictureUrl;
      }
    }
  }

  const finalCandidates = Array.from(deduplicatedMap.values());
  console.log(`✅ ${finalCandidates.length} candidats après déduplication`);

  console.log(`\n💾 === SAUVEGARDE ET ENRICHISSEMENT ===`);

  let savedCount = 0;

  for (const candidate of finalCandidates) {
    try {
      const existingByLinkedIn = candidate.linkedinUrl
        ? await db.query.decisionMakers.findFirst({
            where: and(
              eq(decisionMakers.linkedinUrl, candidate.linkedinUrl),
              eq(decisionMakers.teamId, teamId)
            ),
          })
        : null;

      if (existingByLinkedIn) {
        console.log(`⏭️  ${candidate.name} - Déjà en base (LinkedIn)`);
        continue;
      }

      if (!candidate.linkedinUrl && candidate.source === 'web_search') {
        const linkedinUrl = await findLinkedInProfile({
          name: candidate.name,
          companyName: company.name,
        });
        if (linkedinUrl) {
          candidate.linkedinUrl = linkedinUrl;
        }
      }

      const [inserted] = await db
        .insert(decisionMakers)
        .values({
          teamId,
          companyId,
          fullName: candidate.name,
          title: candidate.title,
          linkedinUrl: candidate.linkedinUrl || null,
          profilePictureUrl: candidate.profilePictureUrl || null,
          relevanceScore: candidate.relevanceScore,
          status: 'discovered',
          emailStatus: 'pending',
          phoneStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log(`✅ ${candidate.name} - Sauvegardé (score: ${candidate.relevanceScore})`);
      savedCount++;

      console.log(`   ⚡ Enrichissement automatique...`);

      const names = candidate.name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');

      const enrichmentTarget: EnrichmentTarget = {
        fullName: candidate.name,
        firstName,
        lastName,
        title: candidate.title,
        companyName: company.name,
        companyWebsite: company.website || undefined,
        linkedinUrl: candidate.linkedinUrl || undefined,
      };

      const enrichmentResult = await enrichContactInfo(enrichmentTarget);

      if (enrichmentResult) {
        await db
          .update(decisionMakers)
          .set({
            email: enrichmentResult.email || null,
            phone: enrichmentResult.phone || null,
            emailStatus: enrichmentResult.email ? 'found' : 'not_found',
            phoneStatus: enrichmentResult.phone ? 'found' : 'not_found',
            updatedAt: new Date(),
          })
          .where(eq(decisionMakers.id, inserted.id));

        console.log(`   ✅ Enrichi: ${enrichmentResult.email ? '📧' : ''} ${enrichmentResult.phone ? '📞' : ''}`);
      } else {
        await db
          .update(decisionMakers)
          .set({
            emailStatus: 'not_found',
            phoneStatus: 'not_found',
            updatedAt: new Date(),
          })
          .where(eq(decisionMakers.id, inserted.id));

        console.log(`   ⚠️ Enrichissement sans résultat`);
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${candidate.name}:`, error);
    }
  }

  console.log(`\n🎉 ${savedCount} nouveaux décideurs sauvegardés et enrichis`);
  console.log(`=======================================\n`);

  return { success: true, count: savedCount };
}
