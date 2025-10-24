import { db } from "@/lib/db";
import { prospectCandidates, prospectFolders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProspectDetailPage({ params }: PageProps) {
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
        .from(prospectCandidates)
        .where(and(
            eq(prospectCandidates.id, id),
            eq(prospectCandidates.teamId, team.id)
        ))
        .limit(1);

    const prospect = rows[0];
    if (!prospect) notFound();

    // Récupérer le dossier si présent
    let folder = null;
    if (prospect.folderId) {
        const folderRows = await db
            .select()
            .from(prospectFolders)
            .where(eq(prospectFolders.id, prospect.folderId))
            .limit(1);
        folder = folderRows[0];
    }

    const displayName = prospect.name || 'Sans nom';

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { className: string; label: string }> = {
            new: { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Nouveau' },
            analyzed: { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Analysé' },
            converted: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Converti' },
        };
        const config = variants[status] || variants.new;
        return (
            <Badge className={config.className}>
                {config.label}
            </Badge>
        );
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            reaction: 'Réaction',
            comment: 'Commentaire',
        };
        return labels[action] || action;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <div className="mb-6">
                <Link
                    href={folder ? `/dashboard/prospects?folder=${folder.id}` : '/dashboard/prospects'}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {folder ? `Retour à ${folder.name}` : 'Retour aux dossiers'}
                </Link>
            </div>

            {/* En-tête */}
            <div className="bg-white border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-gray-900 mb-2">{displayName}</h1>
                        <div className="flex items-center gap-2 mb-4">
                            {getStatusBadge(prospect.status)}
                            <Badge variant="outline" className="text-xs">
                                {getActionLabel(prospect.action)}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Informations principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Poste</div>
                        <div className="text-sm font-medium">{prospect.title || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Entreprise</div>
                        <div className="text-sm font-medium">{prospect.company || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Localisation</div>
                        <div className="text-sm font-medium">{prospect.location || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Collecté le</div>
                        <div className="text-sm font-medium">{formatDate(prospect.fetchedAt)}</div>
                    </div>
                </div>

                {/* Liens */}
                <div className="flex gap-3 pt-4 border-t">
                    {prospect.profileUrl && (
                        <a
                            href={prospect.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Voir le profil LinkedIn
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                    {prospect.postUrl && (
                        <a
                            href={prospect.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                            📝 Voir le post source
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
            </div>

            {/* Commentaire si présent */}
            {prospect.commentText && (
                <div className="bg-white border rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Commentaire</h2>
                    <div className="bg-gray-50 border-l-4 border-blue-600 p-4 rounded">
                        <p className="text-sm text-gray-700 italic">
                            "{prospect.commentText}"
                        </p>
                    </div>
                </div>
            )}

            {/* Score IA */}
            {prospect.aiScore !== null && prospect.aiScore !== undefined && (
                <div className="bg-white border rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Analyse IA</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="text-3xl font-bold text-blue-900">
                                {prospect.aiScore}/100
                            </div>
                            <div className="flex-1">
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all" 
                                        style={{ width: `${prospect.aiScore}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        {prospect.aiReasoning && (
                            <p className="text-sm text-blue-800 mt-3">
                                {prospect.aiReasoning}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Informations techniques */}
            <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-3">Informations techniques</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Source</div>
                        <div className="font-medium">{prospect.source}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Référence source</div>
                        <div className="font-mono text-xs text-gray-600 truncate">{prospect.sourceRef}</div>
                    </div>
                    {prospect.actorUrn && (
                        <div className="md:col-span-2">
                            <div className="text-xs text-gray-500 mb-1">Actor URN</div>
                            <div className="font-mono text-xs text-gray-600 truncate">{prospect.actorUrn}</div>
                        </div>
                    )}
                    {prospect.reactionType && (
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Type de réaction</div>
                            <div className="font-medium">{prospect.reactionType}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
