import React from "react";
import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { leadFolders as leadFoldersTable, leads as leadsTable } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Folder, Plus, Inbox } from "lucide-react";
import Link from "next/link";
import { CreateFolderModal } from "./create-folder-modal";

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

export default async function LeadsPage() {
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
            href={`/dashboard/leads/${folder.id}`}
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
