// app/leads/page.tsx
import React from "react";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { leads as leadsTable } from "@/lib/db/schema";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import LeadStatusForm from "@/components/LeadStatusForm";
import MarkContactedButton from "@/components/MarkContactedButton";
import LeadMessageBox from "./lead-message-box";

// Évite le cache côté route
export const dynamic = "force-dynamic";

/* ===========================
   Types & Schemas
=========================== */
type Lead = typeof leadsTable.$inferSelect;

const LeadSchema = z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    linkedinUrl: z.string().url().optional().or(z.literal("")),
    notes: z.string().optional(),
});

const StatusSchema = z.enum(["new", "contacted", "replied", "qualified", "lost"]);
type Status = z.infer<typeof StatusSchema>;

/* ===========================
   Server Actions (top-level)
=========================== */

/** Créer un lead manuellement (formulaire en haut de page) */
export async function createLead(formData: FormData) {
    "use server";
    
    const teamId = parseInt(String(formData.get("teamId") || "0"));
    if (!teamId) {
        throw new Error('Team ID manquant');
    }

    const raw = {
        email: String(formData.get("email") || ""),
        phone: (formData.get("phone") as string) || undefined,
        firstName: (formData.get("firstName") as string) || undefined,
        lastName: (formData.get("lastName") as string) || undefined,
        company: (formData.get("company") as string) || undefined,
        title: (formData.get("title") as string) || undefined,
        linkedinUrl: (formData.get("linkedinUrl") as string) || "",
        notes: (formData.get("notes") as string) || undefined,
    };

    const parsed = LeadSchema.safeParse(raw);
    if (!parsed.success) return;

    const firstName = parsed.data.firstName?.trim() || '';
    const lastName = parsed.data.lastName?.trim() || '';
    
    if (firstName && lastName) {
        const existingLead = await db.query.leads.findFirst({
            where: and(
                eq(leadsTable.teamId, teamId),
                eq(leadsTable.firstName, firstName),
                eq(leadsTable.lastName, lastName)
            ),
        });

        if (existingLead) {
            console.error('Un lead avec ce nom et prénom existe déjà');
            return;
        }
    }

    const toInsert = {
        ...parsed.data,
        teamId,
        linkedinUrl: parsed.data.linkedinUrl || undefined,
        sourceMode: 'froid',
        status: 'new',
        score: 0,
    };

    await db.insert(leadsTable).values(toInsert);
    revalidatePath("/leads");
}

/** Met à jour le statut d’un lead */
export async function updateLeadStatus(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "");

    const allowed = new Set(["new", "contacted", "replied", "qualified", "lost"]);
    if (!id || !allowed.has(status)) return;

    // SQL brut + cast uuid → pas d'ambiguïté camel/snake
    await db.execute(sql`
        update leads
        set status = ${status}, updated_at = now()
        where id = ${id}::uuid
    `);

    revalidatePath("/leads");
}

/** Met à jour les notes d’un lead */
export async function updateLeadNotes(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const notes = (formData.get("notes") ?? "") as string;

    if (!id) return;

    await db.execute(sql`
        update leads
        set notes = ${notes}, updated_at = now()
        where id = ${id}::uuid
    `);

    revalidatePath("/leads");
}

/* ===========================
   Helpers
=========================== */

function buildMessage(l: Lead): string {
    const fullName = [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email || "là";
    const company = l.company || "votre équipe";
    const title = l.title || "votre rôle";

    return [
        `Bonjour ${fullName},`,
        ``,
        `J’ai vu que vous êtes ${title} chez ${company}.`,
        `On aide des équipes comme la vôtre à gagner du temps sur l’organisation (planif, suivi, reporting) — résultats rapides sans refonte lourde.`,
        ``,
        `Si vous êtes partant, je peux vous montrer en 10 min ce que ça donne sur un cas concret.`,
        `Plutôt mardi 11h ou jeudi 15h ?`,
    ].join("\n");
}

/* ===========================
   Page
=========================== */

export default async function LeadsPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<{ f_status?: string; f_from?: string; f_to?: string; f_order?: "newest" | "oldest" }>;
}) {
    const user = await getUser();
    if (!user) {
        return <div className="p-8">Vous devez être connecté pour voir cette page.</div>;
    }

    const team = await getTeamForUser();
    if (!team) {
        return <div className="p-8">Vous devez faire partie d'une équipe.</div>;
    }

    const params = await searchParams;

    // ---- Lecture des filtres depuis l'URL (noms préfixés pour éviter tout conflit)
    const rawStatus = (params.f_status ?? "").trim();
    const statusFilter: Status | undefined =
        rawStatus && StatusSchema.safeParse(rawStatus).success ? (rawStatus as Status) : undefined;

    const fromDate = params.f_from ? new Date(`${params.f_from}T00:00:00.000Z`) : undefined;
    const toDate = params.f_to ? new Date(`${params.f_to}T23:59:59.999Z`) : undefined;

    const orderBy = params.f_order === "oldest" ? asc(leadsTable.createdAt) : desc(leadsTable.createdAt);

    // ---- Construit les conditions dynamiques
    const conditions: any[] = [eq(leadsTable.teamId, team.id)];
    if (statusFilter) conditions.push(eq(leadsTable.status, statusFilter));
    if (fromDate && !Number.isNaN(fromDate.getTime())) conditions.push(gte(leadsTable.createdAt, fromDate));
    if (toDate && !Number.isNaN(toDate.getTime())) conditions.push(lte(leadsTable.createdAt, toDate));

    // ---- Requête Drizzle avec filtres
    let query: any = db.select().from(leadsTable);
    if (conditions.length) {
        query = query.where(and(...conditions));
    }
    const items: Lead[] = await query.orderBy(orderBy).limit(100);

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
            <h1 className="text-2xl font-semibold">Leads</h1>

            {/* Formulaire d’ajout */}
            <form action={createLead} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border">
                <input type="hidden" name="teamId" value={team.id} />
                <input className="border rounded-lg p-2" name="email" placeholder="Email *" required />
                <input className="border rounded-lg p-2" name="phone" placeholder="Téléphone" />
                <input className="border rounded-lg p-2" name="company" placeholder="Entreprise" />
                <input className="border rounded-lg p-2" name="firstName" placeholder="Prénom" />
                <input className="border rounded-lg p-2" name="lastName" placeholder="Nom" />
                <input className="border rounded-lg p-2 md:col-span-2" name="title" placeholder="Titre de poste" />
                <input className="border rounded-lg p-2 md:col-span-2" name="linkedinUrl" placeholder="URL LinkedIn (https://...)" />
                <textarea className="border rounded-lg p-2 md:col-span-2" name="notes" placeholder="Notes" />
                <button type="submit" className="bg-black text-white rounded-lg px-4 py-2 md:col-span-2 justify-self-start">
                    Ajouter le lead
                </button>
            </form>

            {/* Filtres */}
            <form method="GET" action="/leads" className="flex flex-wrap items-end gap-3 p-4 rounded-xl border">
                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">Statut</label>
                    <select name="f_status" defaultValue={statusFilter ?? ""} className="border rounded p-2 min-w-[160px]">
                        <option value="">Tous</option>
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="replied">replied</option>
                        <option value="qualified">qualified</option>
                        <option value="lost">lost</option>
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">Du</label>
                    <input type="date" name="f_from" defaultValue={params.f_from ?? ""} className="border rounded p-2" />
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">Au</label>
                    <input type="date" name="f_to" defaultValue={params.f_to ?? ""} className="border rounded p-2" />
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">Tri</label>
                    <select name="f_order" defaultValue={params.f_order === "oldest" ? "oldest" : "newest"} className="border rounded p-2 min-w-[160px]">
                        <option value="newest">Plus récent d’abord</option>
                        <option value="oldest">Plus ancien d’abord</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button type="submit" className="border rounded px-3 py-2">Appliquer</button>
                    <a href="/leads" className="text-sm text-gray-600 underline">Réinitialiser</a>
                </div>
            </form>

            {/* Tableau */}
            <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-gray-50 text-left">
                        <th className="p-3">Email</th>
                        <th className="p-3">Téléphone</th>
                        <th className="p-3">Nom</th>
                        <th className="p-3">Entreprise</th>
                        <th className="p-3">Titre</th>
                        <th className="p-3">Statut</th>
                        <th className="p-3">Score</th>
                        <th className="p-3">Créé le</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((l) => (
                        <React.Fragment key={l.id}>
                            {/* Ligne principale */}
                            <tr className="border-t">
                                <td className="p-3">
                                    {l.email ? (
                                        <a href={`mailto:${l.email}`} className="underline hover:no-underline">
                                            {l.email}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500 italic">—</span>
                                    )}
                                </td>

                                <td className="p-3">
                                    {l.phone ? (
                                        <a href={`tel:${l.phone}`} className="underline hover:no-underline">
                                            {l.phone}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500 italic">—</span>
                                    )}
                                </td>

                                <td className="p-3">
                                    {[l.firstName, l.lastName].filter(Boolean).join(" ") || l.email || "—"}
                                </td>

                                <td className="p-3">{l.company}</td>
                                <td className="p-3">{l.title}</td>

                                <td className="p-3">
                                    {/* 🔄 Composant client : update + router.refresh() */}
                                    <LeadStatusForm id={l.id as any} defaultStatus={l.status as any} />
                                </td>

                                <td className="p-3">{l.score}</td>
                                <td className="p-3">{l.createdAt ? new Date(l.createdAt as any).toLocaleDateString() : ""}</td>
                            </tr>

                            {/* Ligne détails : message + actions + notes */}
                            <tr className="bg-gray-50/60">
                                <td colSpan={8} className="p-3">
                                    <details className="group">
                                        <summary className="cursor-pointer select-none text-sm text-gray-700">
                                            Afficher message & actions
                                        </summary>

                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            {/* Message (template ou personnalisé) */}
                                            <LeadMessageBox lead={l as any} />

                                            {/* Actions + Notes */}
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    {/* 1) Ouvrir LinkedIn */}
                                                    {l.linkedinUrl ? (
                                                        <a href={l.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs border rounded px-2 py-1">
                                                            Ouvrir LinkedIn
                                                        </a>
                                                    ) : (
                                                        <button type="button" className="text-xs border rounded px-2 py-1 opacity-50 cursor-not-allowed" title="Aucune URL LinkedIn enregistrée" disabled>
                                                            Ouvrir LinkedIn
                                                        </button>
                                                    )}

                                                    {/* 3) Marquer comme contacté (client) */}
                                                    <MarkContactedButton id={l.id as any} />
                                                </div>

                                                {/* Notes (server action classique) */}
                                                <form action={updateLeadNotes} method="POST" className="flex flex-col gap-2">
                                                    <input type="hidden" name="id" value={l.id} />
                                                    <div className="text-xs text-gray-500">Notes internes</div>
                                                    <textarea name="notes" defaultValue={l.notes ?? ""} className="border rounded p-2 w-full h-24" placeholder="Notes internes…" />
                                                    <button type="submit" className="text-xs border rounded px-2 py-1 self-start">Save notes</button>
                                                </form>

                                                <p className="text-xs text-gray-500">
                                                    {l.linkedinUrl
                                                        ? "Clique sur Copier, ouvre LinkedIn puis colle (⌘/Ctrl+V) le message."
                                                        : "Ajoute une URL LinkedIn au lead pour activer le bouton."}
                                                </p>
                                            </div>
                                        </div>
                                    </details>
                                </td>
                            </tr>
                        </React.Fragment>
                    ))}

                    {items.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-6 text-center text-gray-500">
                                Aucun lead pour l’instant. Ajoute ton premier lead ci-dessus.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
