'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, MessageSquare, ThumbsUp, TrendingUp, Folder } from 'lucide-react';
import { importLeadsFromPost } from '../actions';

type ProspectFolder = {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
};

type LeadEspionFormProps = {
  teamId: number;
  folders: ProspectFolder[];
};

export default function LeadEspionForm({ teamId, folders }: LeadEspionFormProps) {
  const defaultFolder = folders.find(f => f.isDefault) || folders[0];
  const [postUrl, setPostUrl] = useState('');
  const [mode, setMode] = useState<'comments' | 'comments_and_reactions'>('comments');
  const [maxResults, setMaxResults] = useState<number>(10);
  const [selectedFolderId, setSelectedFolderId] = useState<number>(defaultFolder?.id || 0);
  const [state, formAction, isPending] = useActionState(importLeadsFromPost, null);

  const calculateCredits = () => {
    const creditsPerEndpoint = Math.ceil(maxResults / 10);
    return mode === 'comments_and_reactions' ? creditsPerEndpoint * 2 : creditsPerEndpoint;
  };

  const credits = calculateCredits();
  const error = state?.error;
  const duplicatesMsg = state?.duplicatesSkipped > 0 
    ? ` (${state.duplicatesSkipped} doublon${state.duplicatesSkipped > 1 ? 's' : ''} évité${state.duplicatesSkipped > 1 ? 's' : ''})`
    : '';
  const success = state?.count !== undefined 
    ? `${state.count} prospect${state.count > 1 ? 's' : ''} importé${state.count > 1 ? 's' : ''} !${duplicatesMsg}` 
    : '';

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="sourceMode" value="espion" />
        <input type="hidden" name="importMode" value={mode} />
        <input type="hidden" name="maxResults" value={maxResults} />
        <input type="hidden" name="folderId" value={selectedFolderId} />
        
        <div>
          <Label htmlFor="folderId" className="text-sm font-medium">
            Dossier de destination
          </Label>
          <div className="mt-2 relative">
            <select
              id="folderId"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(Number(e.target.value))}
              disabled={isPending}
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <Folder className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Les prospects seront ajoutés à ce dossier
          </p>
        </div>
        
        <div>
          <Label htmlFor="postUrl" className="text-sm font-medium">
            Lien du post LinkedIn
          </Label>
          <Input
            id="postUrl"
            name="postUrl"
            type="url"
            placeholder="https://www.linkedin.com/posts/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            disabled={isPending}
            className="mt-2"
            required
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Le lien est automatiquement nettoyé (tracking supprimé)
          </p>
        </div>

        <div className="border-t pt-6">
          <Label className="text-sm font-medium mb-3 block">
            Que voulez-vous récupérer ?
          </Label>
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              mode === 'comments' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="mode"
                value="comments"
                checked={mode === 'comments'}
                onChange={() => setMode('comments')}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-sm">Commentaires uniquement</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Économique
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Récupère seulement les personnes qui ont commenté
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              mode === 'comments_and_reactions' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="mode"
                value="comments_and_reactions"
                checked={mode === 'comments_and_reactions'}
                onChange={() => setMode('comments_and_reactions')}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-sm">Commentaires + Réactions</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Maximum de leads
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Récupère toutes les personnes (commentaires + likes/réactions)
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t pt-6">
          <Label htmlFor="maxResults" className="text-sm font-medium mb-2 block">
            Nombre de résultats par type
          </Label>
          <select
            id="maxResults"
            name="maxResults"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={isPending}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value={10}>10 résultats (1 crédit par type)</option>
            <option value={20}>20 résultats (2 crédits par type)</option>
            <option value={50}>50 résultats (5 crédits par type)</option>
            <option value={100}>100 résultats (10 crédits par type)</option>
            <option value={200}>200 résultats (20 crédits par type)</option>
            <option value={300}>300 résultats (30 crédits par type)</option>
          </select>
          
          <div className={`mt-3 p-3 rounded-lg border-2 ${
            mode === 'comments' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                💰 Coût total estimé :
              </span>
              <span className={`text-lg font-bold ${
                mode === 'comments' ? 'text-green-700' : 'text-blue-700'
              }`}>
                {credits} crédit{credits > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {mode === 'comments' 
                ? `${maxResults} commentaires × 1 crédit/10 = ${credits} crédit${credits > 1 ? 's' : ''}`
                : `(${maxResults} commentaires + ${maxResults} réactions) × 1 crédit/10 = ${credits} crédits`
              }
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
            <p className="text-sm text-green-700 font-medium">{success}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending || !postUrl}
          className="w-full py-3 text-base font-semibold"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Récupération en cours...
            </>
          ) : (
            <>
              <Users className="mr-2 h-5 w-5" />
              Récupérer les leads ({credits} crédit{credits > 1 ? 's' : ''})
            </>
          )}
        </Button>
      </form>

      {state?.prospects && state.prospects.length > 0 && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {state.prospects.length} prospect{state.prospects.length > 1 ? 's' : ''} récupéré{state.prospects.length > 1 ? 's' : ''}
            </h3>
            <span className="text-sm text-gray-500">
              Ajouté{state.prospects.length > 1 ? 's' : ''} aux prospects
            </span>
          </div>
          
          <div className="space-y-2">
            {state.prospects.slice(0, 10).map((prospect: any, index: number) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  {prospect.action === 'comment' ? (
                    <MessageSquare className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ThumbsUp className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {prospect.name || 'Sans nom'}
                  </p>
                  {prospect.title && (
                    <p className="text-xs text-gray-600 truncate">{prospect.title}</p>
                  )}
                </div>
                {prospect.action === 'comment' ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Commentaire
                  </span>
                ) : (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Réaction
                  </span>
                )}
              </div>
            ))}
            {state.prospects.length > 10 && (
              <p className="text-xs text-center text-gray-500 pt-2">
                + {state.prospects.length - 10} autre{state.prospects.length - 10 > 1 ? 's' : ''} prospect{state.prospects.length - 10 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
