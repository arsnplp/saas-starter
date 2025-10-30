'use client';

import { useState, useEffect } from 'react';
import { Mail, Phone, ClipboardList, ArrowRightCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateBlock, deleteBlock } from './block-actions';
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
  const [config, setConfig] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (block?.config) {
      setConfig(block.config);
    } else {
      setConfig({});
    }
  }, [block]);

  const validate = () => {
    if (!block) return false;

    if (block.type === 'email') {
      if (!config.subject?.trim()) {
        toast.error('Le sujet est requis');
        return false;
      }
      if (!config.body?.trim()) {
        toast.error('Le corps du message est requis');
        return false;
      }
    } else if (block.type === 'call') {
      if (!config.notes?.trim()) {
        toast.error('Les notes sont requises');
        return false;
      }
    } else if (block.type === 'task') {
      if (!config.title?.trim()) {
        toast.error('Le titre est requis');
        return false;
      }
    } else if (block.type === 'transfer') {
      if (!config.targetCampaignId) {
        toast.error('La campagne cible est requise');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!block) return;
    if (!validate()) return;

    setIsSaving(true);
    try {
      const result = await updateBlock(block.id, block.type, config);

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
      const result = await deleteBlock(block.id);

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

  const getIcon = () => {
    switch (block?.type) {
      case 'email':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'call':
        return <Phone className="w-5 h-5 text-green-600" />;
      case 'task':
        return <ClipboardList className="w-5 h-5 text-purple-600" />;
      case 'transfer':
        return <ArrowRightCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Mail className="w-5 h-5 text-blue-600" />;
    }
  };

  const getTitle = () => {
    switch (block?.type) {
      case 'email':
        return 'Configuration - Envoyer un mail';
      case 'call':
        return 'Configuration - Appel';
      case 'task':
        return 'Configuration - Tâche manuelle';
      case 'transfer':
        return 'Configuration - Envoyer à une campagne';
      default:
        return 'Configuration';
    }
  };

  const renderForm = () => {
    if (!block) return null;

    switch (block.type) {
      case 'email':
        return (
          <>
            <div>
              <Label htmlFor="subject">Sujet de l'email *</Label>
              <Input
                id="subject"
                value={config.subject || ''}
                onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                placeholder="Ex: Bonjour {{name}}, j'ai une proposition pour {{company}}"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="body">Corps du message *</Label>
              <Textarea
                id="body"
                value={config.body || ''}
                onChange={(e) => setConfig({ ...config, body: e.target.value })}
                placeholder="Bonjour {{name}},&#10;&#10;Je travaille chez {{company}}..."
                rows={10}
                className="mt-2 font-mono text-sm"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Variables disponibles :</strong> {'{'}{'{'}<strong>name</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>company</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>title</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>email</strong>{'}'}{'}'}
              </p>
            </div>
          </>
        );

      case 'call':
        return (
          <>
            <div>
              <Label htmlFor="notes">Notes d'appel *</Label>
              <Textarea
                id="notes"
                value={config.notes || ''}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                placeholder="Points à discuter lors de l'appel..."
                rows={5}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="deadline">Date limite (optionnel)</Label>
              <Input
                id="deadline"
                type="date"
                value={config.deadline || ''}
                onChange={(e) => setConfig({ ...config, deadline: e.target.value })}
                className="mt-2"
              />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-900">
                Une tâche d'appel sera créée pour chaque prospect. Le numéro de téléphone sera automatiquement récupéré depuis les données du prospect.
              </p>
            </div>
          </>
        );

      case 'task':
        return (
          <>
            <div>
              <Label htmlFor="title">Titre de la tâche *</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Ex: Envoyer un message personnalisé"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={config.description || ''}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Détails supplémentaires..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="deadline">Date limite (optionnel)</Label>
              <Input
                id="deadline"
                type="date"
                value={config.deadline || ''}
                onChange={(e) => setConfig({ ...config, deadline: e.target.value })}
                className="mt-2"
              />
            </div>
          </>
        );

      case 'transfer':
        return (
          <>
            <div>
              <Label htmlFor="targetCampaignId">Campagne cible *</Label>
              <Input
                id="targetCampaignId"
                type="number"
                value={config.targetCampaignId || ''}
                onChange={(e) => setConfig({ ...config, targetCampaignId: parseInt(e.target.value) || '' })}
                placeholder="ID de la campagne"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="delay">Délai (en jours)</Label>
              <Input
                id="delay"
                type="number"
                value={config.delay || 0}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="mt-2"
              />
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-900">
                Le prospect sera automatiquement transféré vers la campagne cible après le délai spécifié. La campagne actuelle sera terminée pour ce prospect.
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={!!block} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {renderForm()}

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
