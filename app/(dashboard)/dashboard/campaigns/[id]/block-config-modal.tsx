'use client';

import { useState, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { updateEmailBlock, deleteEmailBlock } from './block-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type BlockConfigModalProps = {
  block: {
    id: number;
    type: string;
    config: any;
  } | null;
  campaignId: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function BlockConfigModal({
  block,
  campaignId,
  onClose,
  onSuccess,
}: BlockConfigModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (block?.config) {
      setSubject(block.config.subject || '');
      setBody(block.config.body || '');
    }
  }, [block]);

  const handleSave = async () => {
    if (!block) return;

    if (!subject.trim()) {
      toast.error('Le sujet est requis');
      return;
    }

    if (!body.trim()) {
      toast.error('Le corps du message est requis');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateEmailBlock(block.id, {
        subject: subject.trim(),
        body: body.trim(),
      });

      if (result.success) {
        toast.success('Bloc mis à jour');
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!block) return;

    if (!confirm('Supprimer ce bloc ?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteEmailBlock(block.id);

      if (result.success) {
        toast.success('Bloc supprimé');
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={!!block} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Configuration du bloc Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sujet de l'email *
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Bonjour {{name}}, j'ai une proposition pour {{company}}"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Corps du message *
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bonjour {{name}},&#10;&#10;Je travaille chez {{company}}..."
              rows={10}
              className="w-full font-mono text-sm"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>Variables disponibles :</strong> {'{'}{'{'}<strong>name</strong>{'}'}{'}'},
              {' '}{'{'}{'{'}<strong>company</strong>{'}'}{'}'},
              {' '}{'{'}{'{'}<strong>title</strong>{'}'}{'}'},
              {' '}{'{'}{'{'}<strong>email</strong>{'}'}{'}'},
              {' '}{'{'}{'{'}<strong>location</strong>{'}'}{'}'} 
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
