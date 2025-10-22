'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Folder, Trash2, FolderInput, CheckCircle2, Mail, Phone } from 'lucide-react';
import { deleteProspects, moveProspectsToFolder, convertProspectsToLeads } from './actions';
import { toast } from 'sonner';

type Prospect = {
  id: number;
  name: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  action: string;
  profileUrl: string | null;
  postUrl: string | null;
  commentText: string | null;
  reactionType: string | null;
  fetchedAt: Date;
  aiScore: number | null;
  aiReasoning: string | null;
};

type ProspectFolder = {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
};

type Props = {
  prospects: Prospect[];
  folders: ProspectFolder[];
  currentFolderId: number;
};

export function ProspectListClient({ prospects, folders, currentFolderId }: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map(p => p.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const confirm = window.confirm(
      `Êtes-vous sûr de vouloir supprimer ${selectedIds.size} prospect(s) ?`
    );
    
    if (!confirm) return;

    setIsProcessing(true);
    try {
      const result = await deleteProspects(Array.from(selectedIds));
      if (result.success) {
        toast.success(`${selectedIds.size} prospect(s) supprimé(s)`);
        setSelectedIds(new Set());
        setSelectionMode(false);
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (targetFolderId: number) => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const result = await moveProspectsToFolder(Array.from(selectedIds), targetFolderId);
      if (result.success) {
        toast.success(`${selectedIds.size} prospect(s) déplacé(s)`);
        setSelectedIds(new Set());
        setSelectionMode(false);
        setShowFolderModal(false);
      } else {
        toast.error(result.error || 'Erreur lors du déplacement');
      }
    } catch (error) {
      toast.error('Erreur lors du déplacement');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvert = async () => {
    if (selectedIds.size === 0) return;

    const confirm = window.confirm(
      `Marquer ${selectedIds.size} prospect(s) comme converti(s) ? Ils apparaîtront dans la page Leads.`
    );
    
    if (!confirm) return;

    setIsProcessing(true);
    try {
      const result = await convertProspectsToLeads(Array.from(selectedIds));
      if (result.success) {
        toast.success(`${selectedIds.size} prospect(s) converti(s) en leads`);
        setSelectedIds(new Set());
        setSelectionMode(false);
      } else {
        toast.error(result.error || 'Erreur lors de la conversion');
      }
    } catch (error) {
      toast.error('Erreur lors de la conversion');
    } finally {
      setIsProcessing(false);
    }
  };

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
    const labels: Record<string, string> = {
      reaction: 'Réaction',
      comment: 'Commentaire',
    };
    return labels[action] || action;
  };

  if (prospects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-white border rounded-lg">
        <Folder className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucun prospect dans ce dossier
        </h3>
        <p className="text-sm text-gray-500">
          Les prospects apparaîtront ici une fois collectés
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header avec boutons */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedIds(new Set());
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectionMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {selectionMode ? 'Annuler la sélection' : 'Sélectionner'}
          </button>
          
          {selectionMode && (
            <button
              onClick={toggleAll}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {selectedIds.size === prospects.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </div>

        {selectionMode && selectedIds.size > 0 && (
          <span className="text-sm text-gray-600">
            {selectedIds.size} sélectionné(s)
          </span>
        )}
      </div>

      {/* Liste des prospects */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="divide-y">
          {prospects.map((prospect) => (
            <div
              key={prospect.id}
              className={`p-4 transition-colors ${
                selectionMode ? 'hover:bg-blue-50' : 'hover:bg-gray-50'
              } ${selectedIds.has(prospect.id) ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox en mode sélection */}
                {selectionMode && (
                  <div className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(prospect.id)}
                      onChange={() => toggleSelection(prospect.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link 
                      href={`/dashboard/prospects/${prospect.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {prospect.name || 'Sans nom'}
                    </Link>
                    {getStatusBadge(prospect.status)}
                    <Badge variant="outline" className="text-xs">
                      {getActionBadge(prospect.action)}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {prospect.title && <p>{prospect.title}</p>}
                    {prospect.company && <p>{prospect.company}</p>}
                    {prospect.location && <p className="text-gray-500">{prospect.location}</p>}
                  </div>

                  {(prospect.email || prospect.phone) && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {prospect.email && (
                        <a
                          href={`mailto:${prospect.email}`}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {prospect.email}
                        </a>
                      )}
                      {prospect.phone && (
                        <a
                          href={`tel:${prospect.phone}`}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Phone className="w-4 h-4" />
                          {prospect.phone}
                        </a>
                      )}
                    </div>
                  )}

                  {prospect.commentText && (
                    <p className="text-sm text-gray-600 italic mb-2 border-l-2 border-gray-300 pl-3">
                      "{prospect.commentText}"
                    </p>
                  )}

                  {prospect.postUrl && (
                    <div className="text-xs text-gray-500 mb-2">
                      <a
                        href={prospect.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        📝 Post source
                      </a>
                      <span className="mx-2">•</span>
                      <span>{formatDate(prospect.fetchedAt)}</span>
                    </div>
                  )}

                  {prospect.aiScore !== null && prospect.aiScore !== undefined && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-900 mb-1">
                        Score IA: {prospect.aiScore}/100
                      </div>
                      {prospect.aiReasoning && (
                        <p className="text-xs text-blue-800">{prospect.aiReasoning}</p>
                      )}
                    </div>
                  )}
                </div>

                {!selectionMode && (
                  <div className="flex flex-col gap-2 ml-4">
                    {prospect.profileUrl && !prospect.profileUrl.startsWith('temp-') && (
                      <a
                        href={prospect.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      >
                        Profil
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Barre d'actions flottante */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-lg shadow-2xl p-4 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          
          <div className="h-6 w-px bg-gray-700" />
          
          <button
            onClick={handleConvert}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Marquer comme converti
          </button>

          <button
            onClick={() => setShowFolderModal(true)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FolderInput className="w-4 h-4" />
            Changer de dossier
          </button>

          <button
            onClick={handleDelete}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      )}

      {/* Modal de sélection de dossier */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Choisir un dossier de destination
            </h3>
            
            <div className="space-y-2 mb-6">
              {folders
                .filter(f => f.id !== currentFolderId)
                .map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMove(folder.id)}
                    disabled={isProcessing}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                  >
                    <div 
                      className="p-2 rounded-lg" 
                      style={{ backgroundColor: `${folder.color}15` }}
                    >
                      <Folder className="w-5 h-5" style={{ color: folder.color || '#3b82f6' }} />
                    </div>
                    <span className="font-medium text-gray-900">{folder.name}</span>
                    {folder.isDefault && (
                      <span className="ml-auto text-xs text-gray-500">Par défaut</span>
                    )}
                  </button>
                ))}
            </div>

            <button
              onClick={() => setShowFolderModal(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
