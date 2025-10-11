import { Suspense } from 'react';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { prospectCandidates } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, Clock, ExternalLink } from 'lucide-react';

async function getProspects(teamId: number) {
  return await db.query.prospectCandidates.findMany({
    where: eq(prospectCandidates.teamId, teamId),
    orderBy: [desc(prospectCandidates.fetchedAt)],
  });
}

export default async function ProspectsPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const prospects = await getProspects(team.id);

  const newProspects = prospects.filter((p) => p.status === 'new');
  const analyzedProspects = prospects.filter((p) => p.status === 'analyzed');
  const convertedProspects = prospects.filter((p) => p.status === 'converted');

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
          Prospects en attente
        </h1>
        <p className="text-sm text-gray-500">
          Prospects récupérés depuis vos posts LinkedIn qui n'ont pas encore été analysés
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{newProspects.length}</p>
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
              <p className="text-2xl font-bold text-gray-900">{analyzedProspects.length}</p>
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
              <p className="text-2xl font-bold text-gray-900">{convertedProspects.length}</p>
              <p className="text-xs text-gray-500">Convertis en leads</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b">
          <h2 className="font-medium text-gray-900">Tous les prospects</h2>
        </div>
        <div className="divide-y">
          {prospects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Aucun prospect pour le moment</p>
              <p className="text-xs mt-1">
                Importez des leads depuis vos posts LinkedIn pour commencer
              </p>
            </div>
          ) : (
            prospects.map((prospect) => {
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
                const variants: Record<string, { color: string; label: string }> = {
                  reaction: { color: 'bg-blue-100 text-blue-800', label: '👍 Réaction' },
                  comment: { color: 'bg-purple-100 text-purple-800', label: '💬 Commentaire' },
                };
                const config = variants[action] || { color: 'bg-gray-100 text-gray-800', label: action };
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                );
              };

              return (
                <div key={prospect.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {prospect.name || 'Nom inconnu'}
                        </h3>
                        {getStatusBadge(prospect.status)}
                        {getActionBadge(prospect.action)}
                      </div>

                      {prospect.title && (
                        <p className="text-xs text-gray-600 mb-1">{prospect.title}</p>
                      )}
                      {prospect.company && (
                        <p className="text-xs text-gray-500 mb-2">{prospect.company}</p>
                      )}

                      {prospect.commentText && (
                        <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded mb-2 line-clamp-2">
                          "{prospect.commentText}"
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>📅 {formatDate(prospect.fetchedAt)}</span>
                        {prospect.postUrl && (
                          <a
                            href={prospect.postUrl}
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
                      {prospect.profileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={prospect.profileUrl}
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
              );
            })
          )}
        </div>
      </Card>
    </section>
  );
}
