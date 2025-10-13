'use client';

import { useState } from 'react';
import CopyButton from '@/components/CopyButton';
import GenerateMessageButton from './generate-message-button';

interface LeadMessageSectionProps {
  leadId: string;
  linkedinUrl: string | null;
  defaultMessage: string;
}

export default function LeadMessageSection({ 
  leadId, 
  linkedinUrl, 
  defaultMessage 
}: LeadMessageSectionProps) {
  const [currentMessage, setCurrentMessage] = useState(defaultMessage);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          Message personnalisé (à copier/coller)
        </div>
        <GenerateMessageButton 
          leadId={leadId}
          onMessageGenerated={(msg) => setCurrentMessage(msg)}
        />
      </div>

      <textarea
        readOnly
        className="w-full border rounded p-3"
        rows={12}
        value={currentMessage}
      />

      {/* Actions sous le message */}
      <div className="flex items-center gap-2 mt-2">
        {/* Copier le message */}
        <CopyButton text={currentMessage} />

        {/* Ouvrir LinkedIn (désactivé si pas d'URL) */}
        {linkedinUrl ? (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border rounded px-3 py-2 hover:bg-gray-50"
          >
            Ouvrir le profil LinkedIn
          </a>
        ) : (
          <button
            type="button"
            className="text-xs border rounded px-3 py-2 opacity-50 cursor-not-allowed"
            title="Aucune URL LinkedIn enregistrée"
            disabled
          >
            Ouvrir le profil LinkedIn
          </button>
        )}
      </div>
    </div>
  );
}
