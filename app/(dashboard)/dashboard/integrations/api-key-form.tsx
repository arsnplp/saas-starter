'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff, RefreshCw, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createApiKey, regenerateApiKey, deleteApiKey } from './api-key-actions';

type ApiKeyFormProps = {
  initialData: {
    exists: boolean;
    apiKey?: {
      id: number;
      preview: string;
      createdAt: Date;
      lastUsedAt: Date | null;
    };
  };
};

export default function ApiKeyForm({ initialData }: ApiKeyFormProps) {
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [keyData, setKeyData] = useState(initialData.apiKey);
  const [exists, setExists] = useState(initialData.exists);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createApiKey();
      if (result.success && result.key) {
        setCurrentKey(result.key);
        setShowKey(true);
        setExists(true);
        toast.success('Clé API créée avec succès');
      } else {
        toast.error(result.error || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Êtes-vous sûr de vouloir régénérer la clé API ? L\'ancienne clé ne fonctionnera plus.')) {
      return;
    }

    setLoading(true);
    try {
      const result = await regenerateApiKey();
      if (result.success && result.key) {
        setCurrentKey(result.key);
        setShowKey(true);
        toast.success('Clé API régénérée avec succès');
      } else {
        toast.error(result.error || 'Erreur lors de la régénération');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer la clé API ? Cette action est irréversible.')) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteApiKey();
      if (result.success) {
        setCurrentKey(null);
        setKeyData(undefined);
        setExists(false);
        setShowKey(false);
        toast.success('Clé API supprimée');
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (currentKey) {
      navigator.clipboard.writeText(currentKey);
      toast.success('Clé copiée dans le presse-papier');
    }
  };

  if (!exists) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Générez une clé API pour permettre à votre extension Chrome d'importer des prospects directement dans votre compte.
        </p>
        <Button onClick={handleCreate} disabled={loading}>
          <Plus className="w-4 h-4 mr-2" />
          Créer une clé API
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Utilisez cette clé API dans votre extension Chrome pour importer des prospects.
      </p>

      {currentKey && showKey ? (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Votre clé API</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(false)}
              >
                <EyeOff className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <code className="text-sm font-mono bg-white p-2 rounded border block break-all">
            {currentKey}
          </code>
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Copiez cette clé maintenant, elle ne sera plus affichée ensuite.
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {keyData?.preview || 'lead_xxxx...xxxx'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Créée le {keyData?.createdAt ? new Date(keyData.createdAt).toLocaleDateString('fr-FR') : '-'}
              </p>
              {keyData?.lastUsedAt && (
                <p className="text-xs text-gray-500">
                  Dernière utilisation: {new Date(keyData.lastUsedAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Régénérer
        </Button>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={loading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">📝 Exemple d'utilisation</h4>
        <code className="text-xs font-mono bg-white p-3 rounded border block overflow-x-auto">
{`fetch('https://votre-domaine/api/prospects/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'votre_clé_api'
  },
  body: JSON.stringify({
    prospects: [
      {
        name: 'John Doe',
        profileUrl: 'https://linkedin.com/in/johndoe',
        title: 'CEO',
        company: 'Tech Corp'
      }
    ]
  })
})`}
        </code>
      </div>
    </div>
  );
}
