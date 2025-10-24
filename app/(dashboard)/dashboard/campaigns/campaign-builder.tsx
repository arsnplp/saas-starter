'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Blocks, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createCampaign, updateCampaign } from './actions';

type CampaignBlock = {
  id: string;
  type: string;
  config: Record<string, any>;
};

type CampaignBuilderProps = {
  campaign?: {
    id: number;
    name: string;
    description: string | null;
    blocks: any;
    isActive: boolean;
  };
};

export function CampaignBuilder({ campaign }: CampaignBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [blocks, setBlocks] = useState<CampaignBlock[]>(
    Array.isArray(campaign?.blocks) ? campaign.blocks : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom de la campagne est requis');
      return;
    }

    setIsSaving(true);
    try {
      if (campaign) {
        const result = await updateCampaign(campaign.id, {
          name: name.trim(),
          description: description.trim() || null,
          blocks,
        });
        if (result.success) {
          toast.success('Campagne mise à jour avec succès');
          router.push('/dashboard/campaigns');
        } else {
          toast.error(result.error || 'Erreur lors de la mise à jour');
        }
      } else {
        const result = await createCampaign({
          name: name.trim(),
          description: description.trim() || null,
          blocks,
        });
        if (result.success) {
          toast.success('Campagne créée avec succès');
          router.push('/dashboard/campaigns');
        } else {
          toast.error(result.error || 'Erreur lors de la création');
        }
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-lg font-medium text-gray-900">
            {campaign ? 'Modifier la campagne' : 'Nouvelle campagne'}
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la campagne *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Campagne de prospection Q1"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de cette campagne..."
                  rows={3}
                  className="w-full"
                />
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Blocks className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-medium text-gray-900">
                    Séquence d'actions
                  </h2>
                  <p className="text-sm text-gray-500">
                    Construisez votre workflow en ajoutant des blocs
                  </p>
                </div>
              </div>

              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                  <div className="p-4 bg-gray-50 rounded-full mb-4">
                    <Blocks className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Aucun bloc ajouté
                  </h3>
                  <p className="text-xs text-gray-500 text-center max-w-sm mb-4">
                    Glissez des blocs depuis la sidebar de droite pour construire votre campagne
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blocks.map((block, index) => (
                    <div
                      key={block.id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {block.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {block.id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 bg-white border-l p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-base font-medium text-gray-900 mb-2">
              Blocs disponibles
            </h2>
            <p className="text-xs text-gray-500">
              Glissez les blocs vers la zone de construction
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  Bientôt disponible
                </h3>
                <p className="text-xs text-blue-700">
                  Les blocs d'actions seront ajoutés prochainement. Vous pourrez alors construire des workflows complets.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-gray-400">
              Aucun bloc disponible
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
