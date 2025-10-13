import { db } from "@/lib/db";
import { leads, messages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import LeadMessageSection from './lead-message-section';

type PageProps = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: PageProps) {
    const user = await getUser();
    if (!user) {
        redirect('/sign-in');
    }

    const team = await getTeamForUser();
    if (!team) {
        redirect('/sign-in');
    }

    const { id } = await params;
    const rows = await db
        .select()
        .from(leads)
        .where(and(
            eq(leads.id, id),
            eq(leads.teamId, team.id)
        ))
        .limit(1);

    const lead = rows[0];
    if (!lead) notFound();

    const latestMessage = await db
        .select()
        .from(messages)
        .where(and(
            eq(messages.leadId, lead.id),
            eq(messages.teamId, team.id)
        ))
        .orderBy(desc(messages.createdAt))
        .limit(1);

    const message = latestMessage[0]?.messageText || generateMessage(lead);

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

                <LeadMessageSection
                    leadId={lead.id}
                    linkedinUrl={lead.linkedinUrl}
                    defaultMessage={message}
                />

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
