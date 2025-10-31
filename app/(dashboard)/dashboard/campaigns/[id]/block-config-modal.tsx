'use client';

import { useState, useEffect } from 'react';
import { Mail, Phone, ClipboardList, ArrowRightCircle, Clock, Calendar, Clock3, Eye, UserPlus, MessageSquare } from 'lucide-react';
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
    } else if (block.type === 'delay') {
      if (!config.amount || config.amount < 1) {
        toast.error('Le délai doit être d\'au moins 1');
        return false;
      }
      if (!config.unit) {
        toast.error('L\'unité de temps est requise');
        return false;
      }
    } else if (block.type === 'waitUntil') {
      if (!config.waitUntil) {
        toast.error('La date est requise');
        return false;
      }
    } else if (block.type === 'timeSlot') {
      if (!config.hours || config.hours.length === 0) {
        toast.error('Au moins une heure doit être sélectionnée');
        return false;
      }
      if (!config.days || config.days.length === 0) {
        toast.error('Au moins un jour doit être sélectionné');
        return false;
      }
    } else if (block.type === 'linkedInMessage') {
      if (!config.message?.trim()) {
        toast.error('Le message LinkedIn est requis');
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
      case 'delay':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'waitUntil':
        return <Calendar className="w-5 h-5 text-indigo-600" />;
      case 'timeSlot':
        return <Clock3 className="w-5 h-5 text-pink-600" />;
      case 'visitLinkedIn':
        return <Eye className="w-5 h-5 text-teal-600" />;
      case 'addConnection':
        return <UserPlus className="w-5 h-5 text-sky-600" />;
      case 'linkedInMessage':
        return <MessageSquare className="w-5 h-5 text-cyan-600" />;
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
      case 'delay':
        return 'Configuration - Attendre un délai fixe';
      case 'waitUntil':
        return 'Configuration - Attendre jusqu\'à une date';
      case 'timeSlot':
        return 'Configuration - Attendre un créneau horaire';
      case 'visitLinkedIn':
        return 'Configuration - Visiter le profil LinkedIn';
      case 'addConnection':
        return 'Configuration - Ajouter en connexion LinkedIn';
      case 'linkedInMessage':
        return 'Configuration - Message LinkedIn';
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

      case 'delay':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Durée *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={config.amount || ''}
                  onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || '' })}
                  placeholder="2"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unité *</Label>
                <select
                  id="unit"
                  value={config.unit || 'days'}
                  onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Heures</option>
                  <option value="days">Jours</option>
                  <option value="weeks">Semaines</option>
                </select>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-900">
                <strong>Exemple :</strong> Si vous configurez "2 jours", le bloc suivant s'exécutera 2 jours après ce délai. Utile pour envoyer un follow-up après un premier email.
              </p>
            </div>
          </>
        );

      case 'waitUntil':
        return (
          <>
            <div>
              <Label htmlFor="waitUntil">Date et heure *</Label>
              <Input
                id="waitUntil"
                type="datetime-local"
                value={config.waitUntil || ''}
                onChange={(e) => setConfig({ ...config, waitUntil: e.target.value })}
                className="mt-2"
              />
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-sm text-indigo-900">
                <strong>Exemple :</strong> Configurer "5 novembre 2025 à 10h00" pour lancer une action à une date clé (lancement produit, événement, etc.). Tous les prospects attendront cette date avant de continuer.
              </p>
            </div>
          </>
        );

      case 'timeSlot':
        return (
          <>
            <div>
              <Label>Heures autorisées *</Label>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((hour) => {
                  const isSelected = config.hours?.includes(hour);
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => {
                        const hours = config.hours || [];
                        if (isSelected) {
                          setConfig({ ...config, hours: hours.filter((h: number) => h !== hour) });
                        } else {
                          setConfig({ ...config, hours: [...hours, hour].sort() });
                        }
                      }}
                      className={`px-3 py-2 text-sm rounded-md border-2 transition-colors ${
                        isSelected
                          ? 'bg-pink-100 border-pink-500 text-pink-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-pink-300'
                      }`}
                    >
                      {hour}h
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Jours autorisés *</Label>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {[
                  { value: 'Mon', label: 'Lun' },
                  { value: 'Tue', label: 'Mar' },
                  { value: 'Wed', label: 'Mer' },
                  { value: 'Thu', label: 'Jeu' },
                  { value: 'Fri', label: 'Ven' },
                  { value: 'Sat', label: 'Sam' },
                  { value: 'Sun', label: 'Dim' },
                ].map((day) => {
                  const isSelected = config.days?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const days = config.days || [];
                        if (isSelected) {
                          setConfig({ ...config, days: days.filter((d: string) => d !== day.value) });
                        } else {
                          setConfig({ ...config, days: [...days, day.value] });
                        }
                      }}
                      className={`px-3 py-2 text-sm rounded-md border-2 transition-colors ${
                        isSelected
                          ? 'bg-pink-100 border-pink-500 text-pink-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-pink-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <p className="text-sm text-pink-900">
                <strong>Exemple :</strong> Si vous sélectionnez "9h-11h" et "Lun-Mer-Ven", les messages ne seront envoyés que pendant ces créneaux pour respecter les heures de bureau.
              </p>
            </div>
          </>
        );

      case 'visitLinkedIn':
        return (
          <>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <p className="text-sm text-teal-900">
                <strong>Visiter automatiquement le profil LinkedIn du prospect.</strong> Cela permet d'apparaître dans ses visiteurs de profil et d'augmenter la visibilité. Aucune configuration supplémentaire n'est nécessaire.
              </p>
            </div>
          </>
        );

      case 'addConnection':
        return (
          <>
            <div>
              <Label htmlFor="message">Message d'invitation (optionnel)</Label>
              <Textarea
                id="message"
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Bonjour {{name}}, j'aimerais vous ajouter à mon réseau..."
                rows={4}
                className="mt-2"
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-1">
                {config.message?.length || 0}/300 caractères
              </p>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <p className="text-sm text-sky-900">
                <strong>Variables disponibles :</strong> {'{'}{'{'}<strong>name</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>company</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>title</strong>{'}'}{'}'}
              </p>
              <p className="text-xs text-sky-800 mt-2">
                Une invitation de connexion sera envoyée au prospect sur LinkedIn. Le message est optionnel (LinkedIn limite à 300 caractères).
              </p>
            </div>
          </>
        );

      case 'linkedInMessage':
        return (
          <>
            <div>
              <Label htmlFor="message">Message LinkedIn *</Label>
              <Textarea
                id="message"
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Bonjour {{name}},&#10;&#10;Je viens de voir votre profil et j'aimerais échanger avec vous..."
                rows={8}
                className="mt-2 font-mono text-sm"
              />
            </div>
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
              <p className="text-sm text-cyan-900">
                <strong>Variables disponibles :</strong> {'{'}{'{'}<strong>name</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>company</strong>{'}'}{'}'},
                {' '}{'{'}{'{'}<strong>title</strong>{'}'}{'}'}
              </p>
              <p className="text-xs text-cyan-800 mt-2">
                <strong>Important :</strong> Le prospect doit être dans vos connexions LinkedIn pour recevoir ce message. Utilisez le bloc "Ajouter en connexion" avant ce bloc si nécessaire.
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

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
