import React from 'react';
import { redirect } from 'next/navigation';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Play, Plus, Pause, Calendar, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const campaignsList = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.teamId, team.id))
    .orderBy(desc(campaigns.createdAt));

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
            Campagnes
          </h1>
          <p className="text-sm text-gray-500">
            Créez des séquences d'actions automatisées pour vos leads
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle campagne
          </Button>
        </Link>
      </div>

      {campaignsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white border rounded-lg">
          <div className="p-4 bg-blue-50 rounded-full mb-4">
            <Play className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune campagne
          </h3>
          <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
            Créez votre première campagne pour automatiser vos actions de prospection
          </p>
          <Link href="/dashboard/campaigns/new">
            <Button className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Créer une campagne
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaignsList.map((campaign) => {
            const blocks = Array.isArray(campaign.blocks) ? campaign.blocks : [];
            const blockCount = blocks.length;

            return (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="group relative bg-white border rounded-lg p-6 hover:shadow-md transition-all hover:border-blue-400"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {campaign.name}
                      </h3>
                      {campaign.isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Play className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                          <Pause className="w-3 h-3 mr-1" />
                          Pause
                        </Badge>
                      )}
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                        {campaign.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>
                      {blockCount === 0
                        ? 'Aucun bloc'
                        : blockCount === 1
                        ? '1 bloc'
                        : `${blockCount} blocs`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Créée le {formatDate(campaign.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Modifiée le {formatDate(campaign.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
