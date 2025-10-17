'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, Plus } from 'lucide-react';

interface CreatePostFormProps {
  userId: number;
  teamId: number;
}

export function CreatePostForm({ userId, teamId }: CreatePostFormProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const scheduledFor = scheduledDate 
        ? new Date(`${scheduledDate}T${scheduledTime}:00`)
        : new Date();

      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          userId,
          scheduledFor: scheduledFor.toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Post créé avec succès !');
        router.push(`/dashboard/posts/${data.postId}`);
      } else {
        toast.error(data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="scheduledDate" className="text-sm font-medium text-gray-900">
          Date de publication (optionnel)
        </Label>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Laissez vide pour une publication immédiate
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            id="scheduledDate"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            min={today}
          />
          <Input
            type="time"
            id="scheduledTime"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Étapes suivantes</h3>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">1.</span>
            <span>Choisissez le type de post (Call-to-action, Pub, Annonce, Classique)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">2.</span>
            <span>Ajoutez le contexte et les idées principales</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">3.</span>
            <span>GPT génère un post optimisé pour LinkedIn</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">4.</span>
            <span>Modifiez si nécessaire et validez pour programmer</span>
          </li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-[#0A66C2] hover:bg-[#004182]"
      >
        <Plus className="w-4 h-4 mr-2" />
        {isLoading ? 'Création...' : 'Créer le post'}
      </Button>
    </form>
  );
}
