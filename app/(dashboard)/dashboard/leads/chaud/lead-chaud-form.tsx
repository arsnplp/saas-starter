'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users } from 'lucide-react';
import { importLeadsFromPost } from '../actions';

export default function LeadChaudForm({ teamId }: { teamId: number }) {
  const [postUrl, setPostUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!postUrl.trim()) {
      setError('Veuillez entrer un lien de post LinkedIn');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('postUrl', postUrl);
        formData.set('sourceMode', 'chaud');
        formData.set('teamId', teamId.toString());

        const result = await importLeadsFromPost(formData);

        if (result?.error) {
          setError(result.error);
        } else if (result?.count !== undefined) {
          setSuccess(`${result.count} leads importés avec succès !`);
          setPostUrl('');
        }
      } catch (err: any) {
        setError(err.message || 'Une erreur est survenue');
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="postUrl">Lien de votre post LinkedIn</Label>
          <Input
            id="postUrl"
            type="url"
            placeholder="https://www.linkedin.com/posts/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            disabled={isPending}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Collez le lien d'un de vos posts LinkedIn
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
    </div>
  );
}
