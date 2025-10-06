// app/icp/page.tsx
import React from "react";
import { db } from "@/lib/db";
import { icpProfiles, leads } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const IcpSchema = z.object({
    industries: z.string().optional(),
    locations: z.string().optional(),
    buyerRoles: z.string().optional(),
    keywordsInclude: z.string().optional(),
    keywordsExclude: z.string().optional(),
    companySizeMin: z.coerce.number().min(1).default(1),
    companySizeMax: z.coerce.number().min(1).default(10000),
    productCategory: z.string().optional(),
    language: z.string().min(2).max(5).default("fr"),
});

export default async function IcpPage() {
    // On charge le dernier profil ICP saisi
    const [current] = await db.select().from(icpProfiles).orderBy(desc(icpProfiles.id)).limit(1);

    // ---- Server Action : sauvegarder l'ICP ----
    async function saveIcp(formData: FormData) {
        "use server";
        const parsed = IcpSchema.parse({
            industries: (formData.get("industries") as string) || "",
            locations: (formData.get("locations") as string) || "",
            buyerRoles: (formData.get("buyerRoles") as string) || "",
            keywordsInclude: (formData.get("keywordsInclude") as string) || "",
            keywordsExclude: (formData.get("keywordsExclude") as string) || "",
            companySizeMin: formData.get("companySizeMin"),
            companySizeMax: formData.get("companySizeMax"),
            productCategory: (formData.get("productCategory") as string) || "",
            language: (formData.get("language") as string) || "fr",
        });

        await db.insert(icpProfiles).values(parsed);
        revalidatePath("/icp");
    }

    // ---- Server Action : lancer une "recherche" démo et remplir /leads ----
    async function runDiscovery() {
        "use server";
        const [profile] = await db.select().from(icpProfiles).orderBy(desc(icpProfiles.id)).limit(1);

        // Petites listes pour générer 5 leads démos qui respectent (grossièrement) l'ICP
        const roles =
            (profile?.buyerRoles || "Head of Marketing,Marketing Director,Growth Lead")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

        const sectors =
            (profile?.industries || "SaaS,e-commerce,FinTech")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

        const people = [
            { first: "Julie", last: "Martin" },
            { first: "Thomas", last: "Dupont" },
            { first: "Claire", last: "Roche" },
            { first: "Yann", last: "Leroy" },
            { first: "Sarah", last: "Benali" },
        ];

        const toInsert = people.map((p, i) => {
            const company = `${sectors[i % sectors.length] || "Acme"} Labs`;
            const title = roles[i % roles.length] || "Head of Marketing";
            const domain = company.toLowerCase().replace(/\s+/g, "") + ".com";
            return {
                email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@${domain}`,
                firstName: p.first,
                lastName: p.last,
                company,
                title,
                notes: `Auto (démo) – match ICP ${profile?.productCategory || ""}`,
                score: 20 + i * 5, // petit score de priorité
            };
        });

        await db.insert(leads).values(toInsert);
        redirect("/leads"); // on t’emmène voir les résultats
    }

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            <h1 className="text-2xl font-semibold">Profil ICP (cible)</h1>

            <form action={saveIcp} className="grid grid-cols-1 gap-4 rounded-xl border p-4">
                <input
                    name="industries"
                    defaultValue={current?.industries ?? ""}
                    className="border rounded p-2"
                    placeholder='Industries (ex: "SaaS, e-commerce")'
                />
                <input
                    name="locations"
                    defaultValue={current?.locations ?? ""}
                    className="border rounded p-2"
                    placeholder='Zones (ex: "France, Belgium")'
                />
                <input
                    name="buyerRoles"
                    defaultValue={current?.buyerRoles ?? ""}
                    className="border rounded p-2"
                    placeholder='Rôles acheteurs (ex: "CMO, Head of Marketing, Growth Lead")'
                />
                <input
                    name="keywordsInclude"
                    defaultValue={current?.keywordsInclude ?? ""}
                    className="border rounded p-2"
                    placeholder='Mots-clés IN (ex: "SEO, lead gen")'
                />
                <input
                    name="keywordsExclude"
                    defaultValue={current?.keywordsExclude ?? ""}
                    className="border rounded p-2"
                    placeholder='Mots-clés OUT (ex: "agencies, B2C only")'
                />
                <div className="grid grid-cols-2 gap-4">
                    <input
                        name="companySizeMin"
                        type="number"
                        defaultValue={current?.companySizeMin ?? 1}
                        className="border rounded p-2"
                        placeholder="Taille min"
                    />
                    <input
                        name="companySizeMax"
                        type="number"
                        defaultValue={current?.companySizeMax ?? 500}
                        className="border rounded p-2"
                        placeholder="Taille max"
                    />
                </div>
                <input
                    name="productCategory"
                    defaultValue={current?.productCategory ?? ""}
                    className="border rounded p-2"
                    placeholder='Catégorie produit (ex: "MarketingAutomation")'
                />
                <input
                    name="language"
                    defaultValue={current?.language ?? "fr"}
                    className="border rounded p-2"
                    placeholder="Langue (fr/en)"
                />

                <div className="flex gap-2">
                    <button type="submit" className="bg-black text-white rounded px-4 py-2">
                        Enregistrer l’ICP
                    </button>
                </div>
            </form>

            <form action={runDiscovery}>
                <button type="submit" className="border rounded px-4 py-2">
                    Lancer la recherche (démo)
                </button>
            </form>
        </div>
    );
}
