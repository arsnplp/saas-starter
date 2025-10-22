import React from "react";
import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { prospectFolders as prospectFoldersTable, prospectCandidates } from "@/lib/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { Folder, Inbox, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CreateProspectFolderModal } from "./create-folder-modal";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getFoldersWithCounts(teamId: number) {
  const folders = await db
    .select({
      id: prospectFoldersTable.id,
      name: prospectFoldersTable.name,
      color: prospectFoldersTable.color,
      icon: prospectFoldersTable.icon,
      isDefault: prospectFoldersTable.isDefault,
      prospectCount: sql<number>`count(${prospectCandidates.id})::int`.as('prospect_count'),
    })
    .from(prospectFoldersTable)
    .leftJoin(prospectCandidates, eq(prospectCandidates.folderId, prospectFoldersTable.id))
    .where(eq(prospectFoldersTable.teamId, teamId))
    .groupBy(prospectFoldersTable.id)
    .orderBy(prospectFoldersTable.createdAt);

  return folders;
}

async function getProspectsByFolder(folderId: number, teamId: number) {
  return await db.query.prospectCandidates.findMany({
    where: and(
      eq(prospectCandidates.folderId, folderId),
      eq(prospectCandidates.teamId, teamId)
    ),
    orderBy: [desc(prospectCandidates.fetchedAt)],
  });
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { folder?: string };
}) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const existingDefaultFolder = await db.query.prospectFolders.findFirst({
    where: (folders, { and, eq }) => 
      and(
        eq(folders.teamId, team.id),
        eq(folders.isDefault, true)
      ),
  });

  if (!existingDefaultFolder) {
    await db.insert(prospectFoldersTable).values({
      teamId: team.id,
      name: 'Général',
      color: '#3b82f6',
      icon: 'inbox',
      isDefault: true,
    });
  }

  const folders = await getFoldersWithCounts(team.id);
  
  const selectedFolderId = searchParams.folder ? parseInt(searchParams.folder) : null;
  const selectedFolder = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)
    : null;
  
  const folderProspects = selectedFolderId && selectedFolder
    ? await getProspectsByFolder(selectedFolderId, team.id)
    : [];

  if (selectedFolder) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="mb-6">
          <Link
            href="/dashboard/prospects"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux dossiers
          </Link>
          
          <div className="flex items-center gap-3">
            <div 
              className="p-3 rounded-lg" 
              style={{ backgroundColor: `${selectedFolder.color}15` }}
            >
              {selectedFolder.icon === 'inbox' ? (
                <Inbox className="w-6 h-6" style={{ color: selectedFolder.color || '#3b82f6' }} />
              ) : (
                <Folder className="w-6 h-6" style={{ color: selectedFolder.color || '#3b82f6' }} />
              )}
            </div>
            <div>
              <h1 className="text-lg lg:text-2xl font-medium text-gray-900">
                {selectedFolder.name}
              </h1>
              <p className="text-sm text-gray-500">
                {folderProspects.length === 0 
                  ? 'Aucun lead en attente dans ce dossier'
                  : folderProspects.length === 1
                  ? '1 lead en attente'
                  : `${folderProspects.length} leads en attente`
                }
              </p>
            </div>
          </div>
        </div>

        {folderProspects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white border rounded-lg">
            <Folder className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun lead en attente dans ce dossier
            </h3>
            <p className="text-sm text-gray-500">
              Les leads en attente apparaîtront ici une fois collectés
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="divide-y">
              {folderProspects.map((prospect) => {
                const formatDate = (date: Date) => {
                  return new Date(date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                };

                const getStatusBadge = (status: string) => {
                  const variants: Record<string, { variant: any; label: string }> = {
                    new: { variant: 'default' as const, label: 'Nouveau' },
                    analyzed: { variant: 'secondary' as const, label: 'Analysé' },
                    converted: { variant: 'default' as const, label: 'Converti' },
                  };
                  const config = variants[status] || variants.new;
                  return (
                    <Badge variant={config.variant} className={status === 'converted' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                      {config.label}
                    </Badge>
                  );
                };

                const getActionBadge = (action: string) => {
                  const labels: Record<string, string> = {
                    reaction: 'Réaction',
                    comment: 'Commentaire',
                  };
                  return labels[action] || action;
                };

                return (
                  <div key={prospect.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {prospect.name || 'Sans nom'}
                          </h3>
                          {getStatusBadge(prospect.status)}
                          <Badge variant="outline" className="text-xs">
                            {getActionBadge(prospect.action)}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          {prospect.title && <p>{prospect.title}</p>}
                          {prospect.company && <p>{prospect.company}</p>}
                          {prospect.location && <p className="text-gray-500">{prospect.location}</p>}
                        </div>

                        {prospect.commentText && (
                          <p className="text-sm text-gray-600 italic mb-2 border-l-2 border-gray-300 pl-3">
                            "{prospect.commentText}"
                          </p>
                        )}

                        {prospect.postUrl && (
                          <div className="text-xs text-gray-500 mb-2">
                            <a
                              href={prospect.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              📝 Post source
                            </a>
                            <span className="mx-2">•</span>
                            <span>{formatDate(prospect.fetchedAt)}</span>
                          </div>
                        )}

                        {prospect.aiScore !== null && prospect.aiScore !== undefined && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-blue-900 mb-1">
                              Score IA: {prospect.aiScore}/100
                            </div>
                            {prospect.aiReasoning && (
                              <p className="text-xs text-blue-800">{prospect.aiReasoning}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {prospect.profileUrl && (
                          <a
                            href={prospect.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          >
                            Profil
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
            Leads en attente
          </h1>
          <p className="text-sm text-gray-500">
            Organisez vos leads récupérés depuis vos posts LinkedIn
          </p>
        </div>
        <CreateProspectFolderModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {folders.map((folder) => (
          <Link
            key={folder.id}
            href={`/dashboard/prospects?folder=${folder.id}`}
            className="group relative bg-white border rounded-lg p-6 hover:shadow-md transition-all hover:border-blue-400"
          >
            <div className="flex items-start justify-between mb-4">
              <div 
                className="p-3 rounded-lg" 
                style={{ backgroundColor: `${folder.color}15` }}
              >
                {folder.icon === 'inbox' ? (
                  <Inbox className="w-6 h-6" style={{ color: folder.color || '#3b82f6' }} />
                ) : (
                  <Folder className="w-6 h-6" style={{ color: folder.color || '#3b82f6' }} />
                )}
              </div>
              <span className="text-2xl font-bold text-gray-400">
                {folder.prospectCount || 0}
              </span>
            </div>
            
            <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
              {folder.name}
            </h3>
            
            <p className="text-xs text-gray-500">
              {folder.prospectCount === 0 
                ? 'Aucun lead en attente'
                : folder.prospectCount === 1
                ? '1 lead en attente'
                : `${folder.prospectCount} leads en attente`
              }
            </p>

            {folder.isDefault && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Par défaut
                </span>
              </div>
            )}
          </Link>
        ))}

        {folders.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <Folder className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun dossier
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Créez votre premier dossier pour organiser vos leads en attente
            </p>
            <CreateProspectFolderModal />
          </div>
        )}
      </div>
    </section>
  );
}
