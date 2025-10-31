'use client';

import { useState, useEffect } from 'react';
import { Folder, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { assignFolderToCampaign, getCampaignFolders } from './folder-actions';
import { getFolders } from './get-folders-action';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type FolderSelectorCompactProps = {
  campaignId: number;
  onUpdate?: () => void;
};

export function FolderSelectorCompact({ campaignId, onUpdate }: FolderSelectorCompactProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [assignedFolderIds, setAssignedFolderIds] = useState<Set<string>>(new Set());
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
        setAssignedFolderIds(new Set(assignedResult.folders.map(f => String(f.id))));
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
      const isAssigned = assignedFolderIds.has(folderId);
      const result = await assignFolderToCampaign(campaignId, folderId, !isAssigned);

      if (result.success) {
        if (!isAssigned && result.prospectCount) {
          toast.success(`${result.prospectCount} prospect(s) ajouté(s)`);
        } else {
          toast.success(isAssigned ? 'Dossier retiré' : 'Dossier assigné');
        }
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

  const assignedCount = assignedFolderIds.size;
  const totalProspects = folders
    .filter(f => assignedFolderIds.has(f.id.toString()))
    .reduce((sum, f) => sum + (f.prospectCount || 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={loading}>
          <Folder className="w-4 h-4" />
          {assignedCount === 0 ? (
            <span>Sélectionner des dossiers</span>
          ) : (
            <span>
              {assignedCount} dossier{assignedCount > 1 ? 's' : ''} • {totalProspects} prospect{totalProspects > 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {folders.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            Aucun dossier disponible
          </div>
        ) : (
          folders.map((folder) => {
            const isAssigned = assignedFolderIds.has(folder.id.toString());
            return (
              <DropdownMenuCheckboxItem
                key={folder.id}
                checked={isAssigned}
                onCheckedChange={() => handleToggleFolder(folder.id.toString())}
                disabled={loading}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: folder.color || '#3B82F6' }}
                  >
                    <Folder className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{folder.name}</p>
                    <p className="text-xs text-gray-500">
                      {folder.prospectCount || 0} prospect{(folder.prospectCount || 0) > 1 ? 's' : ''}
                    </p>
                  </div>
                  {isAssigned && <Check className="w-4 h-4 text-blue-600" />}
                </div>
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
