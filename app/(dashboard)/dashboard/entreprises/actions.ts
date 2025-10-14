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
