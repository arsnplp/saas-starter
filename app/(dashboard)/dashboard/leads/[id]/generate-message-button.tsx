'use client';

import { useActionState } from 'react';
import { generateLeadMessage } from '../actions';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface GenerateMessageButtonProps {
  leadId: string;
  onMessageGenerated?: (message: string) => void;
}

export default function GenerateMessageButton({ leadId, onMessageGenerated }: GenerateMessageButtonProps) {
  const [state, formAction, isPending] = useActionState(generateLeadMessage, null);

  useEffect(() => {
    if (state?.success && state.message) {
      toast.success('Message personnalisé généré avec succès !');
      onMessageGenerated?.(state.message);
    } else if (state && !state.success) {
      toast.error(state.error || 'Erreur lors de la génération du message');
    }
  }, [state, onMessageGenerated]);

  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {isPending ? '✨ Génération en cours...' : '✨ Générer un message IA'}
      </button>
    </form>
  );
}
