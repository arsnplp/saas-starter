'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ComposeEmailProps {
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
}

export default function ComposeEmail({ onClose, defaultTo = '', defaultSubject = '' }: ComposeEmailProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    if (!to || !subject || !body) {
      toast.error('Tous les champs sont obligatoires');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, subject, body }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Email envoyé avec succès !');
        onClose();
      } else {
        toast.error(data.error || 'Erreur lors de l\'envoi de l\'email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl mx-4">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Nouveau message</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSending}
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Destinataire
            </label>
            <Input
              type="email"
              placeholder="exemple@email.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Objet
            </label>
            <Input
              type="text"
              placeholder="Objet de l'email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Message
            </label>
            <Textarea
              placeholder="Votre message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              disabled={isSending}
              className="resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
