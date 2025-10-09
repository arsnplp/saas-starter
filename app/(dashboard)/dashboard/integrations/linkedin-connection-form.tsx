'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { connectLinkedin, disconnectLinkedin } from './actions';
import { useEffect, useState } from 'react';

export default function LinkedinConnectionForm() {
  const [isConnected, setIsConnected] = useState(false);
  const [linkedinEmail, setLinkedinEmail] = useState<string | null>(null);
  const [connectState, connectAction, isConnectPending] = useActionState(connectLinkedin, { error: '', success: '' });
  const [disconnectState, disconnectAction, isDisconnectPending] = useActionState(disconnectLinkedin, { error: '', success: '' });

  useEffect(() => {
    async function checkConnection() {
      const response = await fetch('/api/linkedin-connection');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.isConnected);
        setLinkedinEmail(data.linkedinEmail);
      }
    }
    checkConnection();
  }, [connectState.success, disconnectState.success]);

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                LinkedIn connecté
              </p>
              {linkedinEmail && (
                <p className="text-xs text-green-700 mt-1">
                  Compte: {linkedinEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        <form action={disconnectAction}>
          {disconnectState.error && (
            <p className="text-red-500 text-sm mb-2">{disconnectState.error}</p>
          )}
          <Button
            type="submit"
            variant="destructive"
            disabled={isDisconnectPending}
          >
            {isDisconnectPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Déconnexion...
              </>
            ) : (
              'Déconnecter LinkedIn'
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form action={connectAction} className="space-y-4">
      <div>
        <Label htmlFor="email">Email LinkedIn</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="votre-email@exemple.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="password">Mot de passe LinkedIn</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          🔒 Vos identifiants LinkedIn sont utilisés une seule fois pour obtenir un token d'authentification.
          Ils ne sont jamais stockés.
        </p>
      </div>

      {connectState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{connectState.error}</p>
        </div>
      )}

      {connectState.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
          <p className="text-sm text-green-800">{connectState.success}</p>
        </div>
      )}

      <Button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isConnectPending}
      >
        {isConnectPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connexion en cours...
          </>
        ) : (
          'Connecter LinkedIn'
        )}
      </Button>
    </form>
  );
}
