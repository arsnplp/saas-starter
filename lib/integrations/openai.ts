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
  problemStatement?: string;
  idealCustomerExample?: string;
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
  const systemPrompt = `Tu es un expert SDR (Sales Development Representative) spécialisé en qualification de leads B2B. Ta tâche est d'analyser un profil LinkedIn et de le scorer de 0 à 100 selon des critères ICP (Ideal Customer Profile).

${icp.problemStatement ? `CONTEXTE BUSINESS :
Notre produit/entreprise : ${icp.problemStatement}
` : ''}
${icp.idealCustomerExample ? `CLIENT IDÉAL :
Profil type parfait : ${icp.idealCustomerExample}
` : ''}
CRITÈRES ICP À RESPECTER :
- Industries cibles : ${icp.industries?.join(", ") || "non spécifié"}
- Localisations cibles : ${icp.locations?.join(", ") || "non spécifié"}
- Rôles recherchés : ${icp.buyerRoles?.join(", ") || "non spécifié"}
- Mots-clés à inclure : ${icp.keywordsInclude?.join(", ") || "non spécifié"}
- Mots-clés à exclure : ${icp.keywordsExclude?.join(", ") || "non spécifié"}
- Taille d'entreprise : ${icp.companySizeMin} - ${icp.companySizeMax} employés
- Score minimum requis : ${icp.minScore}/100

MÉTHODE DE SCORING (pondération adaptative) :

1. FIT MÉTIER (0-30 points)
   - Le rôle a-t-il du POUVOIR de décision/budget pour notre solution ?
   - Correspond-il aux rôles cibles : ${icp.buyerRoles?.join(", ") || "tous rôles"} ?
   ${icp.idealCustomerExample ? `- Ressemble-t-il à notre profil idéal : ${icp.idealCustomerExample} ?` : ''}

2. FIT ENTREPRISE (0-25 points)
   - Taille : ${icp.companySizeMin}-${icp.companySizeMax} employés (strict)
   - Industrie : ${icp.industries?.join(", ") || "toutes industries"} (bonus si vertical exact)
   - Contexte d'entreprise pertinent ?

3. FIT SOLUTION (0-25 points)
   ${icp.problemStatement ? `- Le profil montre-t-il de l'INTÉRÊT potentiel pour notre solution : "${icp.problemStatement}" ?` : ''}
   - Mots-clés pertinents : ${icp.keywordsInclude?.join(", ") || "aucun"}
   - Expérience dans des contextes similaires ?

4. SIGNAUX D'EXCLUSION (-50 points si trouvé)
   - Présence de mots-clés d'exclusion : ${icp.keywordsExclude?.join(", ") || "aucun"}
   - Si trouvé → score maximum = 50

5. LOCALISATION (0-10 points)
   - Géographie : ${icp.locations?.join(", ") || "toutes régions"}

6. SIGNAUX D'ACHAT BONUS (0-10 points)
   - Récemment changé de poste ? (nouveau = opportunité +5pts)
   - Entreprise en croissance ? (croissance = budget +5pts)

${icp.idealCustomerExample ? `
EXEMPLES DE CALIBRATION :
- 90-100 : Profil quasi-identique à "${icp.idealCustomerExample}"
- 70-89 : Bon fit général mais écart sur 1-2 critères
- 50-69 : Fit moyen, pouvoir limité ou contexte incertain
- 0-49 : Mauvais fit ou signaux d'exclusion
` : ''}

Réponds UNIQUEMENT en JSON avec cette structure exacte :
{
  "score": <nombre entre 0 et 100>,
  "reasoning": "<Explication DÉTAILLÉE en français :
    - Fit métier : X/30 car...
    - Fit entreprise : X/25 car...
    - Fit solution : X/25 car...
    - Signaux exclusion : 0 ou -50 car...
    - Localisation : X/10 car...
    - Bonus signaux achat : X/10 car...
    - Recommandation : [Contacter immédiatement / Nurturer d'abord / Ignorer]>"
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
