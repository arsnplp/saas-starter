import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ProfileScoringResult {
  score: number;
  reasoning: string;
  shouldConvertToLead: boolean;
}

export interface ICPCriteria {
  industries?: string[];
  locations?: string[];
  buyerRoles?: string[];
  keywordsInclude?: string[];
  keywordsExclude?: string[];
  companySizeMin: number;
  companySizeMax: number;
  minScore: number;
}

export interface EnrichedProfile {
  name?: string;
  headline?: string;
  location?: string;
  industry?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    company_size?: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
  }>;
  skills?: string[];
  summary?: string;
}

export async function scoreProfileAgainstICP(
  profile: EnrichedProfile,
  icp: ICPCriteria
): Promise<ProfileScoringResult> {
  const systemPrompt = `Tu es un expert en qualification de leads B2B. Ta tâche est d'analyser un profil LinkedIn et de le scorer de 0 à 100 selon des critères ICP (Ideal Customer Profile).

Voici les critères ICP à respecter :
- Industries cibles : ${icp.industries?.join(", ") || "non spécifié"}
- Localisations cibles : ${icp.locations?.join(", ") || "non spécifié"}
- Rôles recherchés : ${icp.buyerRoles?.join(", ") || "non spécifié"}
- Mots-clés à inclure : ${icp.keywordsInclude?.join(", ") || "non spécifié"}
- Mots-clés à exclure : ${icp.keywordsExclude?.join(", ") || "non spécifié"}
- Taille d'entreprise : ${icp.companySizeMin} - ${icp.companySizeMax} employés
- Score minimum requis : ${icp.minScore}/100

Analyse le profil et retourne un score de 0 à 100 basé sur :
1. Correspondance avec l'industrie (20 points)
2. Correspondance avec le rôle/titre (25 points)
3. Localisation pertinente (15 points)
4. Présence de mots-clés pertinents (20 points)
5. Absence de mots-clés d'exclusion (10 points)
6. Taille d'entreprise appropriée (10 points)

Réponds UNIQUEMENT en JSON avec cette structure exacte :
{
  "score": <nombre entre 0 et 100>,
  "reasoning": "<explication détaillée en français du score>"
}`;

  const companySizeFromProfile = profile.experience?.[0]?.company_size;
  
  const userPrompt = `Profil à analyser :
Nom : ${profile.name || "Non spécifié"}
Titre : ${profile.headline || "Non spécifié"}
Localisation : ${profile.location || "Non spécifié"}
Industrie : ${profile.industry || "Non spécifié"}

Expérience professionnelle :
${profile.experience?.map(exp => `- ${exp.title} chez ${exp.company}${exp.company_size ? ` (taille: ${exp.company_size} employés)` : ""} (${exp.duration || "durée non spécifiée"})`).join("\n") || "Non spécifiée"}

Formation :
${profile.education?.map(edu => `- ${edu.degree} en ${edu.field} à ${edu.school}`).join("\n") || "Non spécifiée"}

Compétences : ${profile.skills?.join(", ") || "Non spécifiées"}

${profile.summary ? `Résumé : ${profile.summary}` : ""}

${companySizeFromProfile ? `IMPORTANT : L'entreprise actuelle du candidat a une taille de ${companySizeFromProfile} employés. Compare cela avec la fourchette cible (${icp.companySizeMin}-${icp.companySizeMax}).` : `ATTENTION : Taille d'entreprise non disponible - attribue 5/10 points pour ce critère.`}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const score = Math.max(0, Math.min(100, Math.round(result.score || 0)));
    const shouldConvertToLead = score >= icp.minScore;

    return {
      score,
      reasoning: result.reasoning || "Aucune explication fournie",
      shouldConvertToLead,
    };
  } catch (error) {
    console.error("Error scoring profile with OpenAI:", error);
    throw new Error("Échec du scoring du profil : " + (error as Error).message);
  }
}
