import React from "react";
import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { leadFolders as leadFoldersTable, leads as leadsTable } from "@/lib/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { Folder, Plus, Inbox, ArrowLeft, ExternalLink, Users, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";
import { CreateFolderModal } from "./create-folder-modal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getFoldersWithCounts(teamId: number) {
  const folders = await db
    .select({
      id: leadFoldersTable.id,
      name: leadFoldersTable.name,
      color: leadFoldersTable.color,
      icon: leadFoldersTable.icon,
      isDefault: leadFoldersTable.isDefault,
      leadCount: sql<number>`count(${leadsTable.id})::int`.as('lead_count'),
    })
    .from(leadFoldersTable)
    .leftJoin(leadsTable, eq(leadsTable.folderId, leadFoldersTable.id))
    .where(eq(leadFoldersTable.teamId, teamId))
    .groupBy(leadFoldersTable.id)
    .orderBy(leadFoldersTable.createdAt);

  return folders;
}

async function getLeadsByFolder(folderId: number, teamId: number) {
  return await db.query.leads.findMany({
    where: and(
      eq(leadsTable.folderId, folderId),
      eq(leadsTable.teamId, teamId)
    ),
    orderBy: [desc(leadsTable.createdAt)],
  });
}

export default async function LeadsPage({
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

  // Créer le dossier "Général" s'il n'existe pas
  const existingDefaultFolder = await db.query.leadFolders.findFirst({
    where: (folders, { and, eq }) => 
      and(
        eq(folders.teamId, team.id),
        eq(folders.isDefault, true)
      ),
  });

  if (!existingDefaultFolder) {
    await db.insert(leadFoldersTable).values({
      teamId: team.id,
      name: 'Général',
      color: '#3b82f6',
      icon: 'inbox',
      isDefault: true,
    });
  }

  const folders = await getFoldersWithCounts(team.id);
  
  // Si un dossier est sélectionné, afficher ses leads
  const selectedFolderId = searchParams.folder ? parseInt(searchParams.folder) : null;
  const selectedFolder = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)
    : null;
  
  const folderLeads = selectedFolderId && selectedFolder
    ? await getLeadsByFolder(selectedFolderId, team.id)
    : [];

  // Vue dossier sélectionné
  if (selectedFolder) {
    const newLeads = folderLeads.filter((l) => l.status === 'new');
    const analyzedLeads = folderLeads.filter((l) => l.status === 'contacted' || l.status === 'replied');
    const convertedLeads = folderLeads.filter((l) => l.status === 'qualified');

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
        contacted: { variant: 'secondary' as const, label: 'Contacté' },
        replied: { variant: 'secondary' as const, label: 'Répondu' },
        qualified: { variant: 'default' as const, label: 'Qualifié' },
        lost: { variant: 'default' as const, label: 'Perdu' },
      };
      const config = variants[status] || variants.new;
      return (
        <Badge variant={config.variant} className={status === 'qualified' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
          {config.label}
        </Badge>
      );
    };

    const getEngagementBadge = (engagementType: string | null, reactionType: string | null) => {
      if (engagementType === 'comment') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            💬 Commentaire
          </span>
        );
      }
      if (engagementType === 'reaction') {
        const reactionEmoji = reactionType === 'LIKE' ? '👍' : 
                              reactionType === 'PRAISE' ? '👏' :
                              reactionType === 'SUPPORT' ? '❤️' :
                              reactionType === 'APPRECIATION' ? '💡' :
                              reactionType === 'INTEREST' ? '🤔' :
                              reactionType === 'ENTERTAINMENT' ? '😂' : '👍';
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {reactionEmoji} Réaction
          </span>
        );
      }
      return null;
    };

    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="mb-6">
          <Link
            href="/dashboard/leads"
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
                Leads récupérés depuis vos posts LinkedIn qui n'ont pas encore été analysés
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{newLeads.length}</p>
                <p className="text-xs text-gray-500">Nouveaux</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analyzedLeads.length}</p>
                <p className="text-xs text-gray-500">Analysés</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{convertedLeads.length}</p>
                <p className="text-xs text-gray-500">Convertis en prospects</p>
              </div>
            </div>
          </Card>
        </div>

        {folderLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white border rounded-lg">
            <Folder className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun lead dans ce dossier
            </h3>
            <p className="text-sm text-gray-500">
              Les leads apparaîtront ici une fois ajoutés
            </p>
          </div>
        ) : (
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-medium text-gray-900">Tous les leads</h2>
            </div>
            <div className="divide-y">
              {folderLeads.map((lead) => (
                <div key={lead.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {lead.profilePictureUrl && (
                          <img
                            src={lead.profilePictureUrl}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          {lead.linkedinUrl ? (
                            <a
                              href={lead.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {lead.firstName} {lead.lastName}
                            </a>
                          ) : (
                            <h3 className="text-sm font-medium text-gray-900">
                              {lead.firstName} {lead.lastName}
                            </h3>
                          )}
                          {lead.title && (
                            <p className="text-xs text-gray-600">{lead.title}</p>
                          )}
                          {lead.company && (
                            <p className="text-xs text-gray-500">{lead.company}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(lead.status)}
                          {getEngagementBadge(lead.engagementType, lead.reactionType)}
                        </div>
                      </div>

                      {lead.commentText && (
                        <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded mb-2 line-clamp-2">
                          "{lead.commentText}"
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>📅 {formatDate(lead.createdAt)}</span>
                        {lead.sourcePostUrl && (
                          <a
                            href={lead.sourcePostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Post source
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        ⚡ Scorer
                      </Button>
                      {lead.linkedinUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Profil
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    );
  }

  // Vue tous les dossiers
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
            Leads
          </h1>
          <p className="text-sm text-gray-500">
            Organisez vos leads provenant du monitoring, des entreprises, et des leads froids
          </p>
        </div>
        <CreateFolderModal teamId={team.id} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {folders.map((folder) => (
          <Link
            key={folder.id}
            href={`/dashboard/leads?folder=${folder.id}`}
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
                {folder.leadCount || 0}
              </span>
            </div>
            
            <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
              {folder.name}
            </h3>
            
            <p className="text-xs text-gray-500">
              {folder.leadCount === 0 
                ? 'Aucun lead'
                : folder.leadCount === 1
                ? '1 lead'
                : `${folder.leadCount} leads`
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
              Créez votre premier dossier pour organiser vos leads
            </p>
            <CreateFolderModal teamId={team.id} />
          </div>
        )}
      </div>
    </section>
  );
}
