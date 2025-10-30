'use client';

import { use, useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, Users, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmailBlockForm } from './email-block-form';
import { BlocksList } from './blocks-list';
import { FolderSelector } from './folder-selector';
import { AvailableBlocksSidebar } from './available-blocks-sidebar';
import { getCampaignBlocks } from './block-actions';
import { getCampaignWithDetails } from './actions';

type CampaignDetailProps = {
  campaignId: number;
};

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignResult, blocksResult] = await Promise.all([
        getCampaignWithDetails(campaignId),
        getCampaignBlocks(campaignId),
      ]);

      if (campaignResult.success && campaignResult.campaign) {
        setCampaign(campaignResult.campaign);
      }

      if (blocksResult.success && blocksResult.blocks) {
        setBlocks(blocksResult.blocks);
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Campagne non trouvée</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className="text-lg font-medium text-gray-900">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-sm text-gray-500">{campaign.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{campaign.prospectCount || 0} prospects</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              campaign.isActive 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {campaign.isActive ? (
                <>
                  <Play className="w-3 h-3" />
                  Active
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" />
                  Inactive
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-medium text-gray-900">Blocs de campagne</h2>
                  <p className="text-sm text-gray-500">Séquence d'actions automatisées</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {blocks.length} bloc{blocks.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="mb-6">
                <EmailBlockForm campaignId={campaignId} onSuccess={loadData} />
              </div>

              <BlocksList blocks={blocks} onUpdate={loadData} />
            </div>
          </div>

          <div className="space-y-6">
            <FolderSelector campaignId={campaignId} onUpdate={loadData} />
          </div>

          <div className="space-y-6">
            <AvailableBlocksSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
