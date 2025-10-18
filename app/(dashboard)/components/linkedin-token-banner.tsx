'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, X } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LinkedInTokenBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const { data: tokenStatus } = useSWR<{ valid: boolean; reason?: string }>(
    '/api/linkedin/check-token',
    fetcher,
    {
      refreshInterval: 60000, // Vérifier toutes les 60 secondes
      revalidateOnFocus: true,
    }
  );

  // Réinitialiser le dismissed quand le token devient invalide
  useEffect(() => {
    if (tokenStatus && !tokenStatus.valid) {
      setIsDismissed(false);
    }
  }, [tokenStatus]);

  // Ne rien afficher si :
  // - Le token est valide
  // - L'utilisateur a fermé le bandeau
  // - Pas encore de données
  // - Raison = pas de connexion (il verra ça dans Intégrations)
  if (
    !tokenStatus ||
    tokenStatus.valid ||
    isDismissed ||
    tokenStatus.reason === 'no_connection' ||
    tokenStatus.reason === 'not_authenticated'
  ) {
    return null;
  }

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Votre session LinkedIn a expiré
              </p>
              <p className="text-sm text-red-700">
                Reconnectez-vous pour continuer à enrichir vos prospects et utiliser le mode espion.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Se reconnecter
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-red-400 hover:text-red-600 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
