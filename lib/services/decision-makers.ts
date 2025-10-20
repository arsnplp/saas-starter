import { db } from '@/lib/db/drizzle';
import { decisionMakers, targetCompanies } from '@/lib/db/schema';
import {
  searchLinkedInProfiles,
  enrichLinkedInProfile,
  type LinkUpProfileSearchResult,
} from '@/lib/integrations/linkup';
import { OpenAI } from 'openai';
import { eq, and } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DecisionMakerCandidate {
  name: string;
  title: string;
  linkedinUrl: string;
  profilePictureUrl?: string;
  location?: string;
  relevanceScore: number;
  reasoning: string;
}

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

/**
 * Utilise GPT pour scorer la pertinence d'un profil comme décideur
 */
async function scoreProfileRelevance(
  profile: LinkUpProfileSearchResult,
  companyName: string
): Promise<{ score: number; reasoning: string }> {
  const prompt = `Tu es un expert en identification de décideurs dans le domaine de l'efficacité énergétique et du numérique responsable.

Entreprise cible: ${companyName}

Profil LinkedIn à évaluer:
- Nom: ${profile.name}
- Poste: ${profile.job_title || 'Non renseigné'}
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

/**
 * Cherche des décideurs pour une entreprise donnée
 */
export async function findDecisionMakersForCompany(params: {
  companyId: string;
  teamId: number;
  maxResults?: number;
}): Promise<DecisionMakerCandidate[]> {
  const { companyId, teamId, maxResults = 10 } = params;

  console.log(`\n🔍 === RECHERCHE DE DÉCIDEURS ===`);
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

  console.log(`📌 Entreprise: ${company.name}`);
  console.log(`🔗 LinkedIn: ${company.linkedinUrl}`);

  if (!company.linkedinUrl) {
    throw new Error('URL LinkedIn manquante pour cette entreprise');
  }

  const candidates: DecisionMakerCandidate[] = [];

  for (const title of TARGET_TITLES) {
    try {
      console.log(`\n🎯 Recherche: ${title} @ ${company.name}`);

      const profiles = await searchLinkedInProfiles({
        companyUrl: company.linkedinUrl,
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
          profile,
          company.name
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
          });
          console.log(`   ✅ Candidat ajouté (score: ${score})`);
        }

        if (candidates.length >= maxResults) {
          console.log(`\n✅ Limite atteinte (${maxResults} candidats)`);
          break;
        }
      }

      if (candidates.length >= maxResults) {
        break;
      }
    } catch (error) {
      console.error(`   ❌ Erreur pour le titre "${title}":`, error);
    }
  }

  console.log(`\n📊 Total candidats trouvés: ${candidates.length}`);
  console.log(`===============================\n`);

  return candidates;
}

/**
 * Enrichit un décideur pour récupérer email et téléphone
 */
export async function enrichDecisionMaker(params: {
  decisionMakerId: string;
  teamId: number;
}): Promise<void> {
  const { decisionMakerId, teamId } = params;

  console.log(`\n💎 === ENRICHISSEMENT DÉCIDEUR ===`);
  console.log(`ID: ${decisionMakerId}`);

  const decisionMaker = await db.query.decisionMakers.findFirst({
    where: and(
      eq(decisionMakers.id, decisionMakerId),
      eq(decisionMakers.teamId, teamId)
    ),
    with: {
      company: true,
    },
  });

  if (!decisionMaker) {
    throw new Error('Décideur non trouvé');
  }

  if (!decisionMaker.company) {
    throw new Error('Entreprise non trouvée pour ce décideur');
  }

  const names = decisionMaker.fullName.split(' ');
  const firstName = names[0];
  const lastName = names.slice(1).join(' ');

  console.log(`👤 ${firstName} ${lastName} @ ${decisionMaker.company.name}`);

  try {
    const enrichmentData = await enrichLinkedInProfile({
      firstName,
      lastName,
      companyName: decisionMaker.company.name,
    });

    const email = enrichmentData.full_profile_data?.email;
    const phone = enrichmentData.full_profile_data?.phone;

    console.log(`📧 Email: ${email ? '✅ Trouvé' : '❌ Non trouvé'}`);
    console.log(`📞 Téléphone: ${phone ? '✅ Trouvé' : '❌ Non trouvé'}`);

    await db
      .update(decisionMakers)
      .set({
        email: email || null,
        phone: phone || null,
        emailStatus: email ? 'found' : 'not_found',
        phoneStatus: phone ? 'found' : 'not_found',
        firstName: enrichmentData.person_searched.first_name,
        lastName: enrichmentData.person_searched.last_name,
        enrichmentData: enrichmentData as any,
        updatedAt: new Date(),
      })
      .where(eq(decisionMakers.id, decisionMakerId));

    console.log(`✅ Décideur enrichi avec succès`);
  } catch (error) {
    console.error(`❌ Erreur lors de l'enrichissement:`, error);

    await db
      .update(decisionMakers)
      .set({
        emailStatus: 'not_found',
        phoneStatus: 'not_found',
        updatedAt: new Date(),
      })
      .where(eq(decisionMakers.id, decisionMakerId));

    throw error;
  }

  console.log(`==================================\n`);
}

/**
 * Sauvegarde les décideurs trouvés en base de données
 */
export async function saveDecisionMakers(params: {
  candidates: DecisionMakerCandidate[];
  companyId: string;
  teamId: number;
}): Promise<void> {
  const { candidates, companyId, teamId } = params;

  console.log(`\n💾 === SAUVEGARDE DÉCIDEURS ===`);
  console.log(`Candidats à sauvegarder: ${candidates.length}`);

  for (const candidate of candidates) {
    try {
      const existing = await db.query.decisionMakers.findFirst({
        where: and(
          eq(decisionMakers.linkedinUrl, candidate.linkedinUrl),
          eq(decisionMakers.teamId, teamId)
        ),
      });

      if (existing) {
        console.log(`⏭️  ${candidate.name} - Déjà en base`);
        continue;
      }

      await db.insert(decisionMakers).values({
        teamId,
        companyId,
        fullName: candidate.name,
        title: candidate.title,
        linkedinUrl: candidate.linkedinUrl,
        profilePictureUrl: candidate.profilePictureUrl,
        relevanceScore: candidate.relevanceScore,
        status: 'discovered',
        emailStatus: 'not_found',
        phoneStatus: 'not_found',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`✅ ${candidate.name} - Sauvegardé (score: ${candidate.relevanceScore})`);
    } catch (error) {
      console.error(`❌ Erreur lors de la sauvegarde de ${candidate.name}:`, error);
    }
  }

  console.log(`==============================\n`);
}
