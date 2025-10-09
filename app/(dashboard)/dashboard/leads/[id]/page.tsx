import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";

type PageProps = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: PageProps) {
    const { id } = await params;
    const rows = await db
        .select()
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);

    const lead = rows[0];
    if (!lead) notFound();

    const message = generateMessage(lead);

    const displayName =
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
        lead.email ||
        "Lead";

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            <h1 className="text-2xl font-semibold">{displayName}</h1>

            {lead.linkedinUrl ? (
                <a
                    href={lead.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                >
                    Voir le profil LinkedIn ↗
                </a>
            ) : (
                <p className="text-sm text-gray-500">
                    Pas d’URL LinkedIn enregistrée pour ce lead.
                </p>
            )}

            <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="text-xs text-gray-500">Entreprise</div>
                        <div>{lead.company ?? "—"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">Titre</div>
                        <div>{lead.title ?? "—"}</div>
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-500 mb-1">
                        Message personnalisé (à copier/coller)
                    </div>

                    <textarea
                        readOnly
                        className="w-full border rounded p-3"
                        rows={12}
                        value={message}
                    />

                    {/* Actions sous le message */}
                    <div className="flex items-center gap-2 mt-2">
                        {/* Copier le message */}
                        <CopyButton text={message} />

                        {/* Ouvrir LinkedIn (désactivé si pas d'URL) */}
                        {lead.linkedinUrl ? (
                            <a
                                href={lead.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs border rounded px-3 py-2"
                            >
                                Ouvrir le profil LinkedIn
                            </a>
                        ) : (
                            <button
                                type="button"
                                className="text-xs border rounded px-3 py-2 opacity-50 cursor-not-allowed"
                                title="Aucune URL LinkedIn enregistrée"
                                disabled
                            >
                                Ouvrir le profil LinkedIn
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

function generateMessage(lead: any) {
    const fullName =
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Bonjour";
    const company = lead.company ?? "votre équipe";
    const title = lead.title ? ` (${lead.title})` : "";

    const context = lead.notes?.includes("From post:")
        ? "J’ai vu votre interaction récente sur notre post — merci !"
        : "Je pense que notre outil peut vous intéresser.";

    return `${fullName},

Je travaille sur un outil d’organisation pour ${company}${title} qui aide à gagner du temps sur le suivi des projets et la coordination.

${context}

Si ça vous parle, on peut se caler 15 min ? Voici 2 créneaux (à adapter) : mar 11h / jeu 15h. Sinon dites-moi ce qui vous arrange, ou passez par mon lien : <ton lien Calendly>.

Bonne journée !
— <ta signature>`;
}
