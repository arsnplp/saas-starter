import React from "react";
import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { prospectFolders as prospectFoldersTable, prospectCandidates } from "@/lib/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { Folder, Inbox, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CreateProspectFolderModal } from "./create-folder-modal";
import { AddManualProspectModal } from "./add-manual-prospect-modal";
import { Badge } from "@/components/ui/badge";
import { ProspectListClient } from "./prospect-list-client";

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
  searchParams: Promise<{ folder?: string }>;
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
  
  const params = await searchParams;
  const selectedFolderId = params.folder ? parseInt(params.folder) : null;
  const selectedFolder = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)
    : null;
  
  const folderProspects = selectedFolderId && selectedFolder
    ? await getProspectsByFolder(selectedFolderId, team.id)
    : [];

  if (selectedFolder) {
    const convertedCount = folderProspects.filter(p => p.status === 'converted').length;
    const totalCount = folderProspects.length;
    
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
          
          <div className="flex items-center justify-between mb-6">
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
                  {totalCount === 0 
                    ? 'Aucun lead en attente dans ce dossier'
                    : totalCount === 1
                    ? '1 lead en attente'
                    : `${totalCount} leads en attente`
                  }
                </p>
              </div>
            </div>
            <AddManualProspectModal folders={folders} />
          </div>

          {/* Statistiques du dossier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Folder className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Convertis</p>
                  <p className="text-2xl font-bold text-green-600">{convertedCount}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Taux de conversion</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0}%
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ProspectListClient 
          prospects={folderProspects} 
          folders={folders}
          currentFolderId={selectedFolderId}
        />
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
        <div className="flex gap-3">
          <AddManualProspectModal folders={folders} />
          <CreateProspectFolderModal />
        </div>
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
