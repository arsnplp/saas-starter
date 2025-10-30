'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createCampaign } from './actions';

export function CampaignBuilder() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom de la campagne est requis');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCampaign({
        name: name.trim(),
        description: description.trim() || null,
      });
      
      if (result.success && result.campaignId) {
        toast.success('Campagne créée avec succès');
        router.push(`/dashboard/campaigns/${result.campaignId}`);
      } else {
        toast.error(result.error || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
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
            Nouvelle campagne
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Création...' : 'Créer et configurer'}
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de la campagne *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Campagne de prospection Q1"
                className="w-full"
                autoFocus
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
                rows={4}
                className="w-full"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Prochaine étape :</strong> Après avoir créé votre campagne, vous pourrez ajouter des blocs email et assigner des dossiers de prospects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
