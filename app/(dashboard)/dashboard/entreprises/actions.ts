"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { targetCompanies, icpProfiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser, getTeamForUser } from "@/lib/db/queries";

export async function generateCompaniesAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      message: "Non authentifié",
    };
  }

  const team = await getTeamForUser();
  if (!team) {
    return {
      success: false,
      message: "Équipe introuvable",
    };
  }

  const icpId = parseInt(String(formData.get("icpId") || "0"));
  let count = parseInt(String(formData.get("count") || "15"));

  if (!icpId) {
    return {
      success: false,
      message: "ICP ID manquant",
    };
  }

  count = Math.max(5, Math.min(30, count));

  const icp = await db.query.icpProfiles.findFirst({
    where: and(
      eq(icpProfiles.id, icpId),
      eq(icpProfiles.teamId, team.id)
    ),
  });

  if (!icp) {
    return {
      success: false,
      message: "ICP introuvable ou vous n'y avez pas accès",
    };
  }

  console.log(`\n=== 🤖 GÉNÉRATION GPT D'ENTREPRISES CIBLES ===`);
  console.log(`ICP: ${icp.name}`);
  console.log(`Nombre demandé: ${count}`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = buildPrompt(icp, count);
  console.log(`\n📝 PROMPT ENVOYÉ À GPT:\n${prompt}\n`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en prospection B2B et ciblage d'entreprises. Tu analyses des profils ICP et génères des listes d'entreprises pertinentes à contacter.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const rawResponse = completion.choices[0].message.content?.trim() || "{}";
    console.log(`\n📥 RÉPONSE BRUTE GPT:\n${rawResponse}\n`);

    let parsedResponse: { companies: Array<{ name: string; industry: string; reason: string; linkedin_url?: string }> };
    
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("❌ Erreur de parsing JSON:", parseError);
      return {
        success: false,
        message: "Erreur lors de l'analyse de la réponse GPT",
      };
    }

    if (!parsedResponse.companies || !Array.isArray(parsedResponse.companies)) {
      console.error("❌ Format de réponse invalide:", parsedResponse);
      return {
        success: false,
        message: "Format de réponse GPT invalide",
      };
    }

    console.log(`\n✅ ${parsedResponse.companies.length} entreprises générées par GPT`);

    const existingCompanies = await db.query.targetCompanies.findMany({
      where: eq(targetCompanies.teamId, team.id),
    });

    const existingNames = new Set(existingCompanies.map((c) => c.name.toLowerCase()));
    const newCompanies = parsedResponse.companies.filter(
      (c) => !existingNames.has(c.name.toLowerCase())
    );

    console.log(`\n💾 SAUVEGARDE EN BASE:`);
    console.log(`   Total générées: ${parsedResponse.companies.length}`);
    console.log(`   Doublons ignorés: ${parsedResponse.companies.length - newCompanies.length}`);
    console.log(`   Nouvelles à insérer: ${newCompanies.length}`);

    if (newCompanies.length === 0) {
      return {
        success: false,
        message: "Toutes les entreprises générées existent déjà dans votre base",
        companiesCount: 0,
      };
    }

    for (const company of newCompanies) {
      await db.insert(targetCompanies).values({
        teamId: team.id,
        icpId,
        name: company.name,
        industry: company.industry || null,
        reason: company.reason || null,
        linkedinUrl: company.linkedin_url || null,
        status: "not_contacted",
      });
      console.log(`   ✓ ${company.name} - ${company.industry}`);
    }

    revalidatePath("/dashboard/entreprises");

    return {
      success: true,
      message: `${newCompanies.length} entreprises ajoutées avec succès`,
      companiesCount: newCompanies.length,
    };
  } catch (error) {
    console.error("❌ Erreur GPT:", error);
    return {
      success: false,
      message: `Erreur lors de la génération: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

function buildPrompt(icp: any, count: number): string {
  const industries = icp.industries || "tous secteurs";
  const locations = icp.locations || "toutes régions";
  const problem = icp.problemStatement || "optimisation et efficacité";
  const example = icp.idealCustomerExample || "";

  let prompt = `Génère une liste de ${count} entreprises françaises pertinentes à contacter pour une offre B2B.

**CRITÈRES ICP:**
- Industries: ${industries}
- Localisations: ${locations}
- Problème résolu: ${problem}
${example ? `- Exemple de client idéal: ${example}` : ""}

**INSTRUCTIONS:**
1. Identifie les entreprises qui ont RÉELLEMENT ce problème (pas les revendeurs/intégrateurs)
2. Focus sur les entreprises qui UTILISENT des solutions, pas celles qui les VENDENT
3. Varie la taille des entreprises (PME, ETI, Grandes entreprises)
4. Trouve l'URL LinkedIn de l'entreprise si possible

**FORMAT DE RÉPONSE (JSON STRICT):**
\`\`\`json
{
  "companies": [
    {
      "name": "Nom de l'entreprise",
      "industry": "Secteur d'activité",
      "reason": "Pourquoi cette entreprise est pertinente (1 phrase)",
      "linkedin_url": "linkedin.com/company/nom-entreprise"
    }
  ]
}
\`\`\`

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

  return prompt;
}

// ========== FIND CONTACT ACTION ==========
export async function findContactAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return { success: false, message: "Non authentifié" };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, message: "Équipe introuvable" };
  }

  const companyId = String(formData.get("companyId") || "");
  
  if (!companyId) {
    return { success: false, message: "ID entreprise manquant" };
  }

  // Verify company ownership
  const company = await db.query.targetCompanies.findFirst({
    where: and(
      eq(targetCompanies.id, companyId),
      eq(targetCompanies.teamId, team.id)
    ),
  });

  if (!company) {
    return { success: false, message: "Entreprise introuvable" };
  }

  // Get ICP to know which roles to search for
  const icp = await db.query.icpProfiles.findFirst({
    where: and(
      eq(icpProfiles.id, company.icpId!),
      eq(icpProfiles.teamId, team.id)
    ),
  });

  if (!icp || !icp.buyerRoles) {
    return { success: false, message: "ICP ou postes non définis" };
  }

  const roles = icp.buyerRoles.split(',').map(r => r.trim()).filter(Boolean);
  
  if (roles.length === 0) {
    return { success: false, message: "Aucun poste défini dans l'ICP" };
  }

  console.log(`\n=== 🔍 RECHERCHE DE CONTACT ===`);
  console.log(`Entreprise: ${company.name}`);
  console.log(`URL LinkedIn: ${company.linkedinUrl || "Non disponible"}`);
  console.log(`Postes à chercher: ${roles.join(', ')}`);

  try {
    // Step 1: Generate title variations with GPT
    const variations = await generateTitleVariations(roles[0]);
    console.log(`\n📝 Variations générées pour "${roles[0]}": ${variations.precise.join(', ')}`);

    // Step 2: Cascade search (precise → broad → fallback)
    const result = await cascadeSearch(company, variations, roles);

    if (result.found) {
      // Update company with contact info
      await db.update(targetCompanies)
        .set({
          contactProfile: {
            name: result.contact!.name,
            title: result.contact!.title,
            linkedinUrl: result.contact!.linkedinUrl,
            searchLevel: result.searchLevel!,
            foundWithQuery: result.foundWithQuery!,
          },
          updatedAt: new Date(),
        })
        .where(and(
          eq(targetCompanies.id, companyId),
          eq(targetCompanies.teamId, team.id)
        ));

      revalidatePath("/dashboard/entreprises");

      return {
        success: true,
        message: `Contact trouvé : ${result.contact!.name} (${result.contact!.title})`,
        contact: result.contact,
        searchLevel: result.searchLevel,
      };
    } else {
      return {
        success: false,
        message: "Aucun contact trouvé pour les postes recherchés",
      };
    }
  } catch (error) {
    console.error("❌ Erreur recherche contact:", error);
    return {
      success: false,
      message: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

async function generateTitleVariations(role: string): Promise<{
  precise: string[];
  broad: string[];
  keywords: string[];
}> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Pour le poste "${role}", génère des variations de titres pour trouver la bonne personne sur LinkedIn.

**FORMAT DE RÉPONSE (JSON STRICT):**
{
  "precise": ["variation exacte 1", "variation exacte 2", "variation exacte 3"],
  "broad": ["mot-clé large 1", "mot-clé large 2"],
  "keywords": ["département", "domaine d'expertise"]
}

Exemples:
- Pour "CTO": precise: ["CTO", "Chief Technology Officer", "Directeur Technique"], broad: ["directeur technologie", "responsable IT"], keywords: ["technology", "IT", "digital"]
- Pour "Directeur Marketing": precise: ["Directeur Marketing", "CMO", "Chief Marketing Officer"], broad: ["responsable marketing", "head of marketing"], keywords: ["marketing", "digital marketing"]

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Tu es un expert en titres professionnels et LinkedIn." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      precise: response.precise || [role],
      broad: response.broad || [],
      keywords: response.keywords || [],
    };
  } catch (error) {
    console.error("❌ Erreur génération variations:", error);
    return { precise: [role], broad: [], keywords: [] };
  }
}

async function cascadeSearch(
  company: any,
  variations: { precise: string[]; broad: string[]; keywords: string[] },
  allRoles: string[]
): Promise<{
  found: boolean;
  contact?: { name: string; title: string; linkedinUrl: string };
  searchLevel?: 'precise' | 'broad' | 'fallback';
  foundWithQuery?: string;
}> {
  const linkupApiKey = process.env.LINKUP_API_KEY;
  const linkupBase = process.env.LINKUP_API_BASE || "https://api.linkup.so";

  if (!linkupApiKey) {
    throw new Error("LINKUP_API_KEY non configurée");
  }

  // Extract company URL from LinkedIn URL
  const companyUrl = company.linkedinUrl 
    ? company.linkedinUrl.replace('https://', '').replace('http://', '')
    : null;

  console.log(`\n🔍 NIVEAU 1: Recherche précise (variations exactes)`);
  
  // Level 1: Precise search with exact title variations
  for (const title of variations.precise) {
    const searchParams = companyUrl
      ? { title, company_url: companyUrl, depth: "1" }
      : { keyword: `${title} ${company.name}`, depth: "1" };

    console.log(`   Essai: ${JSON.stringify(searchParams)}`);

    try {
      const response = await fetch(`${linkupBase}/v1/people/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${linkupApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const profile = data.results[0];
          console.log(`   ✅ Trouvé: ${profile.name} (${profile.title})`);
          return {
            found: true,
            contact: {
              name: profile.name || "Nom inconnu",
              title: profile.title || title,
              linkedinUrl: profile.link || "",
            },
            searchLevel: 'precise',
            foundWithQuery: JSON.stringify(searchParams),
          };
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur recherche: ${error}`);
    }
  }

  console.log(`\n🔍 NIVEAU 2: Recherche large (mots-clés)`);

  // Level 2: Broad search with keywords
  for (const keyword of variations.broad) {
    const searchParams = companyUrl
      ? { keyword: `${keyword} ${companyUrl}`, depth: "1" }
      : { keyword: `${keyword} ${company.name}`, depth: "1" };

    console.log(`   Essai: ${JSON.stringify(searchParams)}`);

    try {
      const response = await fetch(`${linkupBase}/v1/people/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${linkupApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const profile = data.results[0];
          console.log(`   ✅ Trouvé: ${profile.name} (${profile.title})`);
          return {
            found: true,
            contact: {
              name: profile.name || "Nom inconnu",
              title: profile.title || keyword,
              linkedinUrl: profile.link || "",
            },
            searchLevel: 'broad',
            foundWithQuery: JSON.stringify(searchParams),
          };
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur recherche: ${error}`);
    }
  }

  console.log(`\n🔍 NIVEAU 3: Recherche fallback (autres postes ICP)`);

  // Level 3: Try other roles from ICP
  for (let i = 1; i < allRoles.length; i++) {
    const role = allRoles[i];
    const searchParams = companyUrl
      ? { title: role, company_url: companyUrl, depth: "1" }
      : { keyword: `${role} ${company.name}`, depth: "1" };

    console.log(`   Essai: ${JSON.stringify(searchParams)}`);

    try {
      const response = await fetch(`${linkupBase}/v1/people/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${linkupApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const profile = data.results[0];
          console.log(`   ✅ Trouvé: ${profile.name} (${profile.title})`);
          return {
            found: true,
            contact: {
              name: profile.name || "Nom inconnu",
              title: profile.title || role,
              linkedinUrl: profile.link || "",
            },
            searchLevel: 'fallback',
            foundWithQuery: JSON.stringify(searchParams),
          };
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur recherche: ${error}`);
    }
  }

  console.log(`\n❌ Aucun contact trouvé après tous les niveaux de recherche`);
  return { found: false };
}
