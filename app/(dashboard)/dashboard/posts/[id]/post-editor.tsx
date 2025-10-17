'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updatePost, validatePost, deletePost } from '../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, Trash2, Edit3, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PostEditorProps {
  post: any;
  autoValidationMode: boolean;
}

const POST_TYPES = [
  { value: 'call_to_action', label: '📣 Call-to-action', description: 'Inciter votre audience à agir' },
  { value: 'publicite', label: '📢 Publicité', description: 'Promouvoir un produit ou service' },
  { value: 'annonce', label: '🎉 Annonce', description: 'Annoncer une nouveauté' },
  { value: 'classique', label: '💬 Classique', description: 'Partager une réflexion ou expérience' },
];

export function PostEditor({ post, autoValidationMode }: PostEditorProps) {
  const [selectedType, setSelectedType] = useState(post.type || 'classique');
  const [userContext, setUserContext] = useState(post.userContext || '');
  const [generatedContent, setGeneratedContent] = useState(post.generatedContent || '');
  const [finalContent, setFinalContent] = useState(post.finalContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setGeneratedContent(post.generatedContent || '');
    setFinalContent(post.finalContent || '');
  }, [post]);

  const handleTypeChange = async (type: string) => {
    setSelectedType(type);
    await updatePost(post.id, { type });
  };

  const handleGenerate = async () => {
    if (!userContext.trim()) {
      toast.error('Veuillez ajouter un contexte pour générer le post');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          type: selectedType,
          userContext,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedContent(data.content);
        setFinalContent(data.content);
        toast.success('Post généré avec succès !');
      } else {
        toast.error(data.error || 'Erreur lors de la génération');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const result = await updatePost(post.id, {
        userContext,
        finalContent,
      });

      if (result.success) {
        toast.success('Post sauvegardé');
        setIsEditing(false);
      } else {
        toast.error(result.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!finalContent.trim()) {
      toast.error('Le post ne peut pas être vide');
      return;
    }

    setIsSaving(true);

    try {
      await updatePost(post.id, { finalContent });
      
      const result = await validatePost(post.id);

      if (result.success) {
        toast.success('Post validé et programmé !');
        router.push('/dashboard/posts');
      } else {
        toast.error(result.error || 'Erreur lors de la validation');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) {
      return;
    }

    try {
      const result = await deletePost(post.id);

      if (result.success) {
        toast.success('Post supprimé');
        router.push('/dashboard/posts');
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handlePublishNow = async () => {
    if (!finalContent.trim()) {
      toast.error('Le post ne peut pas être vide');
      return;
    }

    if (!confirm('Publier ce post immédiatement sur LinkedIn ?')) {
      return;
    }

    setIsSaving(true);

    try {
      await updatePost(post.id, { finalContent });

      const response = await fetch(`/api/posts/${post.id}/publish`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Post publié sur LinkedIn avec succès !');
        router.push('/dashboard/posts');
      } else {
        toast.error(data.error || 'Erreur lors de la publication');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  const currentContent = finalContent || generatedContent;

  return (
    <div className="max-w-5xl space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Type de post</h2>
          {post.scheduledFor && (
            <div className="text-sm text-gray-500">
              📅 Programmé pour le {new Date(post.scheduledFor).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {POST_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleTypeChange(type.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedType === type.value
                  ? 'border-[#0A66C2] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{type.label}</div>
              <div className="text-xs text-gray-500 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <Label htmlFor="context" className="text-lg font-medium text-gray-900">
            Contexte du post
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Décrivez les idées clés, le message principal, ou les points à aborder dans ce post
          </p>
        </div>
        
        <Textarea
          id="context"
          value={userContext}
          onChange={(e) => setUserContext(e.target.value)}
          placeholder="Ex: Parler de l'importance de la prospection B2B, partager une astuce que j'ai découverte récemment, expliquer comment j'ai augmenté mon taux de conversion..."
          className="min-h-[120px] mb-4"
        />

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !userContext.trim()}
          className="w-full bg-[#0A66C2] hover:bg-[#004182]"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? 'Génération en cours...' : 'Générer le post avec GPT'}
        </Button>
      </Card>

      {currentContent && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              {isEditing ? 'Modifier le post' : 'Aperçu du post'}
            </h2>
            <div className="flex gap-2">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
              )}
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFinalContent(generatedContent);
                    setIsEditing(false);
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <>
              <Textarea
                value={finalContent}
                onChange={(e) => setFinalContent(e.target.value)}
                className="min-h-[300px] mb-4 font-sans"
              />
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                <Check className="w-4 h-4 mr-2" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </Button>
            </>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {currentContent}
              </div>
            </div>
          )}
        </Card>
      )}

      {currentContent && !isEditing && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">
                {autoValidationMode ? 'Publication automatique activée' : 'Valider ce post ?'}
              </h3>
              <p className="text-sm text-gray-500">
                {autoValidationMode 
                  ? 'Le post sera publié automatiquement à la date programmée'
                  : 'Le post sera programmé pour publication à la date indiquée'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
              <Button
                onClick={handlePublishNow}
                disabled={isSaving}
                variant="outline"
                className="bg-[#0A66C2] text-white hover:bg-[#004182]"
              >
                <Check className="w-4 h-4 mr-2" />
                {isSaving ? 'Publication...' : 'Publier maintenant'}
              </Button>
              {!autoValidationMode && (
                <Button
                  onClick={handleValidate}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isSaving ? 'Validation...' : 'Valider et programmer'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
