'use client';

import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { generateLeadMessage } from './actions';
import CopyButton from '@/components/CopyButton';

type Lead = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  linkedinUrl: string | null;
};

function buildTemplateMessage(l: Lead): string {
  const fullName = [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email || "là";
  const company = l.company || "votre équipe";
  const title = l.title || "votre rôle";

  return [
    `Bonjour ${fullName},`,
    ``,
    `J'ai vu que vous êtes ${title} chez ${company}.`,
    `On aide des équipes comme la vôtre à gagner du temps sur l'organisation (planif, suivi, reporting) — résultats rapides sans refonte lourde.`,
    ``,
    `Si vous êtes partant, je peux vous montrer en 10 min ce que ça donne sur un cas concret.`,
    `Plutôt mardi 11h ou jeudi 15h ?`,
  ].join("\n");
}

export default function LeadMessageBox({ lead }: { lead: Lead }) {
  const templateMessage = buildTemplateMessage(lead);
  const [currentMessage, setCurrentMessage] = useState(templateMessage);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [state, formAction, isPending] = useActionState(generateLeadMessage, null);

  useEffect(() => {
    if (state?.success && state.message) {
      toast.success('Message personnalisé généré avec succès !');
      setCurrentMessage(state.message);
      setIsPersonalized(true);
    } else if (state && !state.success) {
      toast.error(state.error || 'Erreur lors de la génération du message');
    }
  }, [state]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          {isPersonalized ? '✨ Message personnalisé avec IA' : '📝 Message template'}
        </div>
        <form action={formAction}>
          <input type="hidden" name="leadId" value={lead.id} />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs bg-primary hover:bg-primary/90 text-white rounded px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Génération...' : '✨ Personnaliser'}
          </button>
        </form>
      </div>
      
      <textarea 
        className="border rounded-lg p-3 w-full h-40" 
        readOnly 
        value={currentMessage}
      />
      
      <div className="flex items-center gap-2">
        <CopyButton text={currentMessage} />
        {isPersonalized && (
          <button
            type="button"
            onClick={() => {
              setCurrentMessage(templateMessage);
              setIsPersonalized(false);
            }}
            className="text-xs border rounded px-2 py-1 text-gray-600 hover:bg-gray-50"
          >
            Revenir au template
          </button>
        )}
      </div>
    </div>
  );
}
