'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updatePostSettings, generateWeeklySlots } from '../actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, Zap } from 'lucide-react';

interface PostSettingsFormProps {
  initialPostsPerWeek: number;
  initialAutoValidationMode: boolean;
}

export function PostSettingsForm({ 
  initialPostsPerWeek, 
  initialAutoValidationMode 
}: PostSettingsFormProps) {
  const [postsPerWeek, setPostsPerWeek] = useState(initialPostsPerWeek);
  const [autoValidationMode, setAutoValidationMode] = useState(initialAutoValidationMode);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updatePostSettings(postsPerWeek, autoValidationMode);
      
      if (result.success) {
        toast.success('Configuration mise à jour avec succès');
        router.push('/dashboard/posts');
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSlots = async () => {
    setIsLoading(true);

    try {
      const saveResult = await updatePostSettings(postsPerWeek, autoValidationMode);
      
      if (!saveResult.success) {
        toast.error('Erreur lors de la sauvegarde de la configuration');
        setIsLoading(false);
        return;
      }

      const result = await generateWeeklySlots();
      
      if (result.success) {
        toast.success(`${result.slotsCreated} posts créés pour cette semaine`);
        router.push('/dashboard/posts');
      } else {
        toast.error(result.error || 'Erreur lors de la génération des slots');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="postsPerWeek" className="text-sm font-medium text-gray-900">
            Nombre de posts par semaine
          </Label>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Choisissez combien de posts vous souhaitez publier chaque semaine
          </p>
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPostsPerWeek(num)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  postsPerWeek === num
                    ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2] font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Label htmlFor="autoValidationMode" className="text-sm font-medium text-gray-900">
                Mode de validation
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                {autoValidationMode 
                  ? '🤖 Les posts sont générés et publiés automatiquement' 
                  : '✋ Vous validez chaque post avant publication'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoValidationMode(!autoValidationMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoValidationMode ? 'bg-[#0A66C2]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoValidationMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {autoValidationMode && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                ⚠️ En mode automatique, les posts générés par GPT seront publiés directement sans votre validation.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[#0A66C2] hover:bg-[#004182]"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {isLoading ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </Button>
        
        <Button
          type="button"
          onClick={handleGenerateSlots}
          disabled={isLoading}
          variant="outline"
          className="flex-1"
        >
          <Zap className="w-4 h-4 mr-2" />
          {isLoading ? 'Génération...' : 'Générer les posts de la semaine'}
        </Button>
      </div>

      <div className="pt-4 border-t">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Comment ça marche ?</h3>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">1.</span>
            <span>Configurez le nombre de posts par semaine et le mode de validation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">2.</span>
            <span>Cliquez sur "Générer les posts de la semaine" pour créer automatiquement des slots vides</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">3.</span>
            <span>Pour chaque post, choisissez le type (Call-to-action, Pub, Annonce, Classique)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">4.</span>
            <span>Ajoutez votre contexte et laissez GPT générer le contenu</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#0A66C2]">5.</span>
            <span>Validez ou modifiez le post avant publication (sauf en mode automatique)</span>
          </li>
        </ul>
      </div>
    </form>
  );
}
