'use client';

import { useState } from 'react';
import { Mail, Phone, Linkedin, User, AlertCircle, Download } from 'lucide-react';
import { enrichDecisionMakerAction } from '../actions';
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

export function DecisionMakersList({ decisionMakers }: { decisionMakers: DecisionMaker[] }) {
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

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
        const needsEnrichment = maker.emailStatus === 'not_found' || maker.phoneStatus === 'not_found';

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
                    <h3 className="text-lg font-semibold text-gray-900">
                      {maker.fullName}
                    </h3>
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
                    {needsEnrichment && (
                      <button
                        onClick={() => handleEnrich(maker.id)}
                        disabled={isEnriching}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-linkedin-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        {isEnriching ? 'Enrichissement...' : 'Enrichir'}
                      </button>
                    )}
                    
                    <a
                      href={maker.linkedinUrl.startsWith('http') ? maker.linkedinUrl : `https://${maker.linkedinUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-linkedin-blue hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {maker.email ? (
                      <a
                        href={`mailto:${maker.email}`}
                        className="text-linkedin-blue hover:underline truncate"
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
                        className="text-linkedin-blue hover:underline"
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
    </div>
  );
}
