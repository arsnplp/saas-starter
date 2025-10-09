'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Shield } from 'lucide-react';
import { connectLinkedin, disconnectLinkedin, verifyLinkedinCode } from './actions';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function LinkedinConnectionForm() {
  const [isConnected, setIsConnected] = useState(false);
  const [linkedinEmail, setLinkedinEmail] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [connectState, connectAction, isConnectPending] = useActionState(connectLinkedin, { error: '', success: '', needsVerification: false });
  const [disconnectState, disconnectAction, isDisconnectPending] = useActionState(disconnectLinkedin, { error: '', success: '' });
  const [verifyState, verifyAction, isVerifyPending] = useActionState(verifyLinkedinCode, { error: '', success: '' });

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
  }, [connectState.success, disconnectState.success, verifyState.success]);

  useEffect(() => {
    if (connectState.needsVerification) {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      if (emailInput?.value) {
        setVerificationEmail(emailInput.value);
      }
      setShowVerificationModal(true);
    }
  }, [connectState.needsVerification]);

  useEffect(() => {
    if (verifyState.success) {
      setShowVerificationModal(false);
    }
  }, [verifyState.success]);

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

      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Vérification en deux étapes
            </DialogTitle>
            <DialogDescription>
              {connectState.message || 'Un code de vérification a été envoyé à votre email LinkedIn'}
            </DialogDescription>
          </DialogHeader>

          <form action={verifyAction} className="space-y-4 mt-4">
            <input type="hidden" name="email" value={verificationEmail} />
            <input type="hidden" name="country" value="FR" />
            
            <div>
              <Label htmlFor="code">Code de vérification</Label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="Entrez le code reçu par email"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Vérifiez votre email LinkedIn ({verificationEmail})
              </p>
            </div>

            {verifyState.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-800">{verifyState.error}</p>
              </div>
            )}

            {verifyState.success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <p className="text-sm text-green-800">{verifyState.success}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowVerificationModal(false)}
                disabled={isVerifyPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                disabled={isVerifyPending}
              >
                {isVerifyPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  'Vérifier le code'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  );
}
