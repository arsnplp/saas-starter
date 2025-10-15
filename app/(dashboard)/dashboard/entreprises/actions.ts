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

  // Get existing companies to avoid duplicates
  const existingCompanies = await db.query.targetCompanies.findMany({
    where: and(
      eq(targetCompanies.teamId, team.id),
      eq(targetCompanies.icpId, icpId)
    ),
  });

  const alreadySuggested = existingCompanies.map((c) => c.name);
  console.log(`\n📋 Entreprises déjà suggérées pour cet ICP: ${alreadySuggested.length}`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = buildPrompt(icp, count, alreadySuggested);
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

function buildPrompt(icp: any, count: number, alreadySuggested: string[]): string {
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
5. **IMPORTANT: NE SUGGÈRE PAS ces entreprises déjà proposées:**
${alreadySuggested.length > 0 ? alreadySuggested.map(name => `   - ${name}`).join('\n') : '   (Aucune entreprise à éviter pour l\'instant)'}

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

  console.log(`\n=== 🔍 RECHERCHE DE CONTACT INTELLIGENTE ===`);
  console.log(`Entreprise: ${company.name}`);
  console.log(`URL LinkedIn: ${company.linkedinUrl || "Non disponible"}`);
  console.log(`Postes cibles: ${roles.join(', ')}`);

  try {
    // Step 1: Web research to find decision makers
    console.log(`\n📡 ÉTAPE 1: Recherche web approfondie...`);
    const webResults = await searchDecisionMakers(company.name, roles);
    console.log(`   Résultats web récupérés: ${webResults.length > 0 ? 'Oui' : 'Non'}`);

    // Step 2: GPT analyzes web results to extract names and titles
    console.log(`\n🤖 ÉTAPE 2: Analyse GPT des résultats...`);
    const extractedContacts = await extractContactsFromWeb(webResults, company.name, roles);
    console.log(`   Contacts identifiés: ${extractedContacts.length}`);

    if (extractedContacts.length === 0) {
      return {
        success: false,
        message: "Aucun décideur identifié via la recherche web",
      };
    }

    // Step 3: Use LinkUp to find LinkedIn profiles
    console.log(`\n🔍 ÉTAPE 3: Recherche LinkUp avec infos précises...`);
    const result = await searchLinkedInProfiles(company, extractedContacts);

    if (result.found) {
      // Update company with contact info
      await db.update(targetCompanies)
        .set({
          contactProfile: {
            name: result.contact!.name,
            title: result.contact!.title,
            linkedinUrl: result.contact!.linkedinUrl,
            searchMethod: 'web_research',
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
      };
    } else {
      return {
        success: false,
        message: "Contact identifié sur le web mais profil LinkedIn introuvable",
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

// Step 1: Web search to find decision makers
async function searchDecisionMakers(companyName: string, roles: string[]): Promise<string> {
  try {
    const searchQuery = `${companyName} ${roles.join(' OR ')} directeur responsable décideur`;
    console.log(`   Recherche: "${searchQuery}"`);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY || '',
        query: searchQuery,
        search_depth: 'advanced',
        max_results: 5,
      }),
    });

    if (!response.ok) {
      console.error(`   ❌ Erreur API Tavily: ${response.status}`);
      return '';
    }

    const data = await response.json();
    const combinedResults = data.results
      ?.map((r: any) => `${r.title}\n${r.content}`)
      .join('\n\n') || '';
    
    console.log(`   Résultats obtenus: ${combinedResults.length} caractères`);
    return combinedResults;
  } catch (error) {
    console.error(`   ❌ Erreur recherche web:`, error);
    return '';
  }
}

// Step 2: GPT extracts contact info from web results
async function extractContactsFromWeb(
  webResults: string,
  companyName: string,
  roles: string[]
): Promise<Array<{ firstName: string; lastName: string; title: string }>> {
  if (!webResults) {
    return [];
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Analyse ces résultats web sur l'entreprise "${companyName}" et identifie les décideurs pertinents.

**RÉSULTATS WEB:**
${webResults.slice(0, 3000)}

**POSTES RECHERCHÉS:**
${roles.join(', ')}

**INSTRUCTIONS:**
1. Trouve les noms complets (prénom + nom) des personnes mentionnées
2. Identifie leur titre/poste exact
3. Ne retiens que les personnes ayant un poste de décision pertinent
4. Si tu trouves plusieurs personnes, priorise par pertinence

**FORMAT DE RÉPONSE (JSON STRICT):**
{
  "contacts": [
    {
      "firstName": "Prénom",
      "lastName": "Nom",
      "title": "Titre exact"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Tu es un expert en identification de décideurs B2B." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");
    const contacts = response.contacts || [];
    
    contacts.forEach((c: any) => {
      console.log(`   → ${c.firstName} ${c.lastName} - ${c.title}`);
    });

    return contacts;
  } catch (error) {
    console.error("❌ Erreur extraction GPT:", error);
    return [];
  }
}

// Step 3: Search LinkedIn profiles with LinkUp using precise names
async function searchLinkedInProfiles(
  company: any,
  extractedContacts: Array<{ firstName: string; lastName: string; title: string }>
): Promise<{
  found: boolean;
  contact?: { name: string; title: string; linkedinUrl: string };
  foundWithQuery?: string;
}> {
  const linkupApiKey = process.env.LINKUP_API_KEY;
  const linkupApiBase = process.env.LINKUP_API_BASE || "https://api.linkupapi.com";

  if (!linkupApiKey) {
    throw new Error("LINKUP_API_KEY non configurée");
  }

  // Extract company URL from LinkedIn URL
  const companyUrl = company.linkedinUrl 
    ? company.linkedinUrl.replace('https://', '').replace('http://', '')
    : null;

  if (!companyUrl) {
    console.log(`   ⚠️ Pas d'URL LinkedIn pour l'entreprise, recherche impossible`);
    return { found: false };
  }

  // Try each extracted contact
  for (const contact of extractedContacts) {
    const searchParams = {
      first_name: contact.firstName,
      last_name: contact.lastName,
      company_url: companyUrl,
    };

    console.log(`   Recherche: ${contact.firstName} ${contact.lastName} @ ${company.name}`);
    console.log(`   Params: ${JSON.stringify(searchParams)}`);

    try {
      const response = await fetch(`${linkupApiBase}/v1/profile/search`, {
        method: "POST",
        headers: {
          "x-api-key": linkupApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
      });

      console.log(`   📡 Statut LinkUp: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`   📦 Réponse LinkUp:`, JSON.stringify(data).slice(0, 300));
        
        // LinkUp returns data in: { status: "success", data: { results: [...] } }
        const results = data?.data?.results || data?.results || [];
        
        if (results.length > 0) {
          const profile = results[0];
          console.log(`   ✅ Profil LinkedIn trouvé: ${profile.name || `${contact.firstName} ${contact.lastName}`}`);
          return {
            found: true,
            contact: {
              name: profile.name || `${contact.firstName} ${contact.lastName}`,
              title: contact.title,
              linkedinUrl: profile.linkedin_url || profile.link || "",
            },
            foundWithQuery: JSON.stringify(searchParams),
          };
        } else {
          console.log(`   ⚠️ Aucun résultat dans la réponse LinkUp`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur LinkUp: ${error}`);
    }
  }

  console.log(`\n❌ Aucun profil LinkedIn trouvé pour les contacts identifiés`);
  return { found: false };
}
