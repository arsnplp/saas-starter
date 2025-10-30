'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Mail, Sparkles } from 'lucide-react';
import { createEmailBlock } from './block-actions';

type EmailBlockFormProps = {
  campaignId: number;
  onSuccess?: () => void;
};

export function EmailBlockForm({ campaignId, onSuccess }: EmailBlockFormProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !body.trim()) {
      toast.error('Le sujet et le corps sont requis');
      return;
    }

    setLoading(true);
    try {
      const result = await createEmailBlock(campaignId, { subject, body });
      if (result.success) {
        toast.success('Bloc email ajouté avec succès');
        setSubject('');
        setBody('');
        setShowForm(false);
        onSuccess?.();
      } else {
        toast.error(result.error || 'Erreur lors de l\'ajout du bloc');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    setBody(prev => prev + `{{${variable}}}`);
  };

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} className="w-full">
        <Mail className="w-4 h-4 mr-2" />
        Ajouter un bloc Email
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4 bg-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">Nouveau bloc Email</h3>
          <p className="text-xs text-gray-500">Configurez l'email à envoyer</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sujet *
        </label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex: Bonjour {{name}}, j'ai vu votre profil..."
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Corps de l'email *
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Bonjour {{name}},&#10;&#10;Je suis tombé sur votre profil et j'ai vu que vous travaillez chez {{company}} en tant que {{title}}..."
          rows={8}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Sparkles className="w-4 h-4 inline mr-1" />
          Variables disponibles
        </label>
        <div className="flex flex-wrap gap-2">
          {['name', 'company', 'title', 'location'].map((variable) => (
            <Button
              key={variable}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertVariable(variable)}
              className="text-xs"
            >
              {`{{${variable}}}`}
            </Button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Ces variables seront automatiquement remplacées par les données du prospect
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Ajout en cours...' : 'Ajouter le bloc'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowForm(false);
            setSubject('');
            setBody('');
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
