'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Folder, Check } from 'lucide-react';
import { toast } from 'sonner';
import { assignFolderToCampaign, getCampaignFolders } from './folder-actions';
import { getFolders } from './get-folders-action';

type FolderSelectorProps = {
  campaignId: number;
  onUpdate?: () => void;
};

export function FolderSelector({ campaignId, onUpdate }: FolderSelectorProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [assignedFolders, setAssignedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [foldersResult, assignedResult] = await Promise.all([
        getFolders(),
        getCampaignFolders(campaignId),
      ]);

      if (foldersResult.success && foldersResult.folders) {
        setFolders(foldersResult.folders);
      }

      if (assignedResult.success && assignedResult.folders) {
        setAssignedFolders(new Set(assignedResult.folders.map(f => f.id)));
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const handleToggleFolder = async (folderId: string) => {
    setLoading(true);
    try {
      const isAssigned = assignedFolders.has(folderId);
      const result = await assignFolderToCampaign(campaignId, folderId, !isAssigned);

      if (result.success) {
        toast.success(
          isAssigned 
            ? 'Dossier retiré de la campagne' 
            : `Dossier assigné (${result.prospectCount} prospects ajoutés)`
        );
        await loadData();
        onUpdate?.();
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="mb-4">
        <h2 className="text-base font-medium text-gray-900">Dossiers assignés</h2>
        <p className="text-sm text-gray-500">
          Sélectionnez les dossiers pour ajouter leurs prospects
        </p>
      </div>

      <div className="space-y-2">
        {folders.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            Aucun dossier disponible
          </div>
        ) : (
          folders.map((folder) => {
            const isAssigned = assignedFolders.has(folder.id);
            
            return (
              <button
                key={folder.id}
                onClick={() => handleToggleFolder(folder.id)}
                disabled={loading}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  isAssigned
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: folder.color || '#3B82F6' }}
                    >
                      <Folder className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {folder.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {folder.prospectCount || 0} prospect{(folder.prospectCount || 0) > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {isAssigned && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
