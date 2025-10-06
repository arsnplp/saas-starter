// app/engagement/post/page.tsx
import React from "react";
import { fetchReactions, fetchComments } from "@/lib/integrations/linkup_social";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Typage de l'insert pour éviter les erreurs TS
type NewLead = typeof leads.$inferInsert;

export default function ImportPostEngagementPage() {
    // Server Action appelée au submit du formulaire
    async function ingest(formData: FormData) {
        "use server";

        const postUrl = String(formData.get("postUrl") || "").trim();
        if (!postUrl) return;

        // 1) Récupérer réactions + commentaires via l'API (helper déjà créé)
        const [reacs, comms] = await Promise.all([
            fetchReactions(postUrl, 500),
            fetchComments(postUrl, 500),
        ]);

        // 2) Dédupliquer par profileUrl (une personne = une ligne)
        const uniqueByProfile = new Map<string, { name?: string | null }>();
        for (const r of reacs) if (r.profileUrl) uniqueByProfile.set(r.profileUrl, { name: r.name });
        for (const c of comms)
            if (c.profileUrl && !uniqueByProfile.has(c.profileUrl))
                uniqueByProfile.set(c.profileUrl, { name: c.name });

        const profileUrls = Array.from(uniqueByProfile.keys());

        // 3) Écarter ceux déjà en base (on compare à leads.linkedinUrl)
        const existing =
            profileUrls.length > 0
                ? await db
                    .select({ linkedinUrl: leads.linkedinUrl })
                    .from(leads)
                    .where(inArray(leads.linkedinUrl, profileUrls))
                : [];
        const existingSet = new Set(existing.map((e) => e.linkedinUrl ?? ""));

        // 4) Construire les nouveaux leads (sans champs inconnus du schéma)
        const toInsert: NewLead[] = profileUrls
            .filter((u) => !existingSet.has(u))
            .map((u): NewLead => {
                const name = uniqueByProfile.get(u)?.name || "";
                const [firstName, ...rest] = name.split(" ").filter(Boolean);
                const lastName = rest.join(" ") || undefined;

                return {
                    // IMPORTANT : utiliser undefined (pas null) pour les champs optionnels
                    email: undefined,                 // on enrichira plus tard
                    firstName: firstName || undefined,
                    lastName: lastName,
                    company: undefined,
                    title: undefined,
                    status: "new",                    // statut de départ
                    score: 0,                         // score manuel de départ
                    linkedinUrl: u,                   // clé pour déduplication
                    notes: `From post: ${postUrl}`,
                    // createdAt/updatedAt: valeurs par défaut en DB
                };
            });

        // 5) Insérer et rediriger vers /leads
        if (toInsert.length) {
            await db.insert(leads).values(toInsert);
        }

        revalidatePath("/leads");
        redirect("/leads");
    }

    return (
        <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Importer des leads depuis un post LinkedIn</h1>
    <p className="text-sm text-gray-600">
        Colle l’URL d’un post LinkedIn (peu importe l’auteur). L’app récupère réactions &amp; commentaires,
        déduplique les profils et les ajoute comme leads.
    </p>
    <form action={ingest} className="space-y-4 border rounded-xl p-4">
    <input
        name="postUrl"
    placeholder="https://www.linkedin.com/posts/..."
    className="border rounded p-2 w-full"
    required
    />
    <button type="submit" className="border rounded px-4 py-2">Importer</button>
        </form>
        </div>
);
}
