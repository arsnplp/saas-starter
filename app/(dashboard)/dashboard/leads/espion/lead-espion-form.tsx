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
  const success = state?.count !== undefined ? `${state.count} leads importés avec succès !` : '';

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="sourceMode" value="espion" />
        
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
          className="w-full bg-orange-500 hover:bg-orange-600"
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
