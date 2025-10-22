'use client';

import { useState } from 'react';
import { Mail, Phone, Linkedin, User, AlertCircle, Download, FolderInput, Folder, Inbox } from 'lucide-react';
import { enrichDecisionMakerAction, importDecisionMakerToProspects } from '../actions';
import { toast } from 'sonner';

interface DecisionMaker {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string;
  profilePictureUrl: string | null;
  relevanceScore: number | null;
  emailStatus: string;
  phoneStatus: string;
  status: string;
}

interface ProspectFolder {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
}

export function DecisionMakersList({ 
  decisionMakers, 
  prospectFolders 
}: { 
  decisionMakers: DecisionMaker[];
  prospectFolders?: ProspectFolder[];
}) {
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedDecisionMaker, setSelectedDecisionMaker] = useState<DecisionMaker | null>(null);

  const handleEnrich = async (id: string) => {
    setEnrichingIds((prev) => new Set(prev).add(id));

    try {
      const result = await enrichDecisionMakerAction(id);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enrichissement');
    } finally {
      setEnrichingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleImportClick = (maker: DecisionMaker) => {
    setSelectedDecisionMaker(maker);
    setShowFolderModal(true);
  };

  const handleImport = async (folderId: number) => {
    if (!selectedDecisionMaker) return;

    setImportingId(selectedDecisionMaker.id);
    try {
      const result = await importDecisionMakerToProspects(selectedDecisionMaker.id, folderId);
      
      if (result.success) {
        toast.success('Décideur importé comme prospect');
        setShowFolderModal(false);
        setSelectedDecisionMaker(null);
      } else {
        toast.error(result.error || 'Erreur lors de l\'import');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'import');
    } finally {
      setImportingId(null);
    }
  };

  if (decisionMakers.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucun décideur trouvé
        </h3>
        <p className="text-sm text-gray-600">
          Utilisez le bouton "Trouver des décideurs" ci-dessus pour lancer une recherche automatique.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {decisionMakers.map((maker) => {
        const isEnriching = enrichingIds.has(maker.id);
        const needsEnrichment = maker.emailStatus === 'pending' || maker.phoneStatus === 'pending';
        const hasRealLinkedinUrl = maker.linkedinUrl && !maker.linkedinUrl.startsWith('temp-');

        return (
          <div key={maker.id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {maker.profilePictureUrl ? (
                  <img
                    src={maker.profilePictureUrl}
                    alt={maker.fullName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-linkedin-blue flex items-center justify-center text-white text-xl font-semibold">
                    {maker.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {hasRealLinkedinUrl ? (
                      <a
                        href={maker.linkedinUrl.startsWith('http') ? maker.linkedinUrl : `https://${maker.linkedinUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-semibold text-linkedin-blue hover:underline cursor-pointer"
                      >
                        {maker.fullName}
                      </a>
                    ) : (
                      <h3 className="text-lg font-semibold text-gray-900">
                        {maker.fullName}
                      </h3>
                    )}
                    {maker.title && (
                      <p className="text-sm text-gray-600 mt-1">{maker.title}</p>
                    )}
                    {maker.relevanceScore !== null && (
                      <div className="mt-2">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Score: {maker.relevanceScore}/100
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {prospectFolders && prospectFolders.length > 0 && hasRealLinkedinUrl && (
                      <button
                        onClick={() => handleImportClick(maker)}
                        disabled={importingId === maker.id}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderInput className="w-4 h-4" />
                        {importingId === maker.id ? 'Import...' : 'Importer'}
                      </button>
                    )}
                    
                    {needsEnrichment && hasRealLinkedinUrl && (
                      <button
                        onClick={() => handleEnrich(maker.id)}
                        disabled={isEnriching}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-linkedin-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        {isEnriching ? 'Enrichissement...' : 'Enrichir'}
                      </button>
                    )}
                    
                    {hasRealLinkedinUrl && (
                      <a
                        href={maker.linkedinUrl.startsWith('http') ? maker.linkedinUrl : `https://${maker.linkedinUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-linkedin-blue hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                      </a>
                    )}
                    
                    {!hasRealLinkedinUrl && (
                      <div className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg">
                        <Linkedin className="w-4 h-4" />
                        Profil non trouvé
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {maker.email ? (
                      <a
                        href={`mailto:${maker.email}`}
                        className="text-linkedin-blue hover:underline break-all"
                      >
                        {maker.email}
                      </a>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Non trouvé
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {maker.phone ? (
                      <a
                        href={`tel:${maker.phone}`}
                        className="text-linkedin-blue hover:underline whitespace-nowrap"
                      >
                        {maker.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Non trouvé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal de sélection de dossier */}
      {showFolderModal && prospectFolders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Importer dans un dossier
            </h3>
            
            <div className="space-y-2 mb-6">
              {prospectFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleImport(folder.id)}
                  disabled={importingId !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div 
                    className="p-2 rounded-lg" 
                    style={{ backgroundColor: `${folder.color}15` }}
                  >
                    {folder.icon === 'inbox' ? (
                      <Inbox className="w-5 h-5" style={{ color: folder.color || '#3b82f6' }} />
                    ) : (
                      <Folder className="w-5 h-5" style={{ color: folder.color || '#3b82f6' }} />
                    )}
                  </div>
                  <span className="font-medium text-gray-900">{folder.name}</span>
                  {folder.isDefault && (
                    <span className="ml-auto text-xs text-gray-500">Par défaut</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowFolderModal(false);
                setSelectedDecisionMaker(null);
              }}
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
