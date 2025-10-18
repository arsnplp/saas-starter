'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, MessageSquare, ThumbsUp } from 'lucide-react';
import { importLeadsFromPost } from '../actions';

type Engagement = {
  type: 'reaction' | 'comment';
  firstName: string;
  lastName: string;
  headline?: string;
  profileUrl: string;
  profilePictureUrl?: string;
  reactionType?: string;
  commentText?: string;
};

export default function LeadEspionForm({ teamId }: { teamId: number }) {
  const [postUrl, setPostUrl] = useState('');
  const [importMode, setImportMode] = useState<'all' | 'comments_only'>('all');
  const [maxResults, setMaxResults] = useState<number>(10);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [state, formAction, isPending] = useActionState(importLeadsFromPost, null);

  // Update engagements when state changes
  if (state?.leads && state.leads.length > 0 && engagements.length === 0) {
    const mappedEngagements = state.leads.map((lead: any) => ({
      type: lead.engagementType || 'reaction',
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      headline: lead.title || '',
      profileUrl: lead.linkedinUrl || '',
      profilePictureUrl: lead.profilePictureUrl || '',
      reactionType: lead.reactionType,
      commentText: lead.commentText,
    }));
    setEngagements(mappedEngagements);
  }

  const error = state?.error;
  const duplicatesMsg = state?.duplicatesSkipped > 0 
    ? ` (${state.duplicatesSkipped} doublon${state.duplicatesSkipped > 1 ? 's' : ''} évité${state.duplicatesSkipped > 1 ? 's' : ''})`
    : '';
  const success = state?.count !== undefined 
    ? `${state.count} prospect${state.count > 1 ? 's' : ''} importé${state.count > 1 ? 's' : ''} avec succès !${duplicatesMsg}` 
    : '';

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="sourceMode" value="espion" />
        <input type="hidden" name="importMode" value={importMode} />
        <input type="hidden" name="maxResults" value={maxResults} />
        
        <div>
          <Label htmlFor="postUrl">Lien du post LinkedIn</Label>
          <Input
            id="postUrl"
            name="postUrl"
            type="url"
            placeholder="https://www.linkedin.com/posts/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            disabled={isPending}
            className="mt-1"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Collez le lien d'un post LinkedIn pour récupérer les personnes qui ont réagi ou commenté
          </p>
        </div>

        <div>
          <Label>Mode d'importation</Label>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="importMode"
                value="comments_only"
                checked={importMode === 'comments_only'}
                onChange={(e) => setImportMode(e.target.value as 'comments_only')}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">Commentateurs uniquement</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Économique</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Récupère seulement les personnes qui ont commenté (1 appel API = économie de crédits)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="importMode"
                value="all"
                checked={importMode === 'all'}
                onChange={(e) => setImportMode(e.target.value as 'all')}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Tous (réactions + commentaires)</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Récupère toutes les personnes qui ont réagi ou commenté (2 appels API)
                </p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <Label htmlFor="maxResults">Nombre de résultats maximum</Label>
          <select
            id="maxResults"
            name="maxResults"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={isPending}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value={10}>10 résultats (1 crédit)</option>
            <option value={20}>20 résultats (2 crédits)</option>
            <option value={50}>50 résultats (5 crédits)</option>
            <option value={100}>100 résultats (10 crédits)</option>
            <option value={200}>200 résultats (20 crédits)</option>
            <option value={300}>300 résultats (30 crédits)</option>
            <option value={500}>500 résultats (50 crédits)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            💰 Coût par endpoint : 1 crédit = 10 résultats. 
            {importMode === 'all' ? (
              <span className="font-medium text-orange-600"> Mode "Tous" = {Math.ceil(maxResults / 10) * 2} crédits (réactions + commentaires)</span>
            ) : (
              <span className="font-medium text-green-600"> Mode "Commentaires uniquement" = {Math.ceil(maxResults / 10)} crédit(s)</span>
            )}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Récupération en cours...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Récupérer les leads
            </>
          )}
        </Button>
      </form>

      {engagements.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">
            {engagements.length} personne{engagements.length > 1 ? 's' : ''} trouvée{engagements.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {engagements.map((engagement, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
              >
                {engagement.profilePictureUrl ? (
                  <img
                    src={engagement.profilePictureUrl}
                    alt={`${engagement.firstName} ${engagement.lastName}`}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {engagement.firstName} {engagement.lastName}
                    </p>
                    {engagement.type === 'reaction' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        <ThumbsUp className="w-3 h-3" />
                        {engagement.reactionType || 'Réaction'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                        <MessageSquare className="w-3 h-3" />
                        Commentaire
                      </span>
                    )}
                  </div>
                  {engagement.headline && (
                    <p className="text-xs text-gray-600 mt-1">{engagement.headline}</p>
                  )}
                  {engagement.commentText && (
                    <p className="text-sm text-gray-700 mt-2 italic">"{engagement.commentText}"</p>
                  )}
                  <a
                    href={engagement.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600 mt-1 inline-block"
                  >
                    Voir le profil →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
