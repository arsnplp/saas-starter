'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Shield, TestTube2 } from 'lucide-react';
import { connectLinkedin, disconnectLinkedin, verifyLinkedinCode } from './actions';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConnectionInfo {
  isConnected: boolean;
  linkedinEmail: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  connectedBy: string | null;
  isProbablyExpired?: boolean;
  daysSinceLastUse?: number;
}

export default function LinkedinConnectionForm() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    isConnected: false,
    linkedinEmail: null,
    connectedAt: null,
    lastUsedAt: null,
    connectedBy: null,
  });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [connectState, connectAction, isConnectPending] = useActionState(connectLinkedin, { error: '', success: '', needsVerification: false, message: '', linkedinEmail: '' });
  const [disconnectState, disconnectAction, isDisconnectPending] = useActionState(disconnectLinkedin, { error: '', success: '' });
  const [verifyState, verifyAction, isVerifyPending] = useActionState(verifyLinkedinCode, { error: '', success: '' });

  useEffect(() => {
    async function checkConnection() {
      const response = await fetch('/api/linkedin-connection');
      if (response.ok) {
        const data = await response.json();
        setConnectionInfo(data);
      }
    }
    checkConnection();
  }, [connectState.success, disconnectState.success, verifyState.success]);

  useEffect(() => {
    if (connectState.needsVerification) {
      setVerificationEmail(connectState.linkedinEmail || '');
      setShowVerificationModal(true);
    }
  }, [connectState.needsVerification, connectState.linkedinEmail]);

  useEffect(() => {
    if (verifyState.success) {
      setShowVerificationModal(false);
    }
  }, [verifyState.success]);

  if (connectionInfo.isConnected) {
    const formatDate = (dateString: string | null) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const isExpired = connectionInfo.isProbablyExpired;

    return (
      <div className="space-y-4">
        <div className={`rounded-lg p-4 ${isExpired ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start gap-3">
            {isExpired ? (
              <XCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium mb-2 ${isExpired ? 'text-yellow-900' : 'text-green-900'}`}>
                {isExpired ? '⚠️ Session LinkedIn probablement expirée' : '✅ LinkedIn connecté'}
              </p>
              
              {isExpired && (
                <p className="text-xs text-yellow-800 mb-3 bg-yellow-100 p-2 rounded">
                  📅 Dernière utilisation il y a {connectionInfo.daysSinceLastUse} jours. 
                  Les sessions LinkedIn expirent généralement après 30 jours d'inactivité. 
                  <strong> Reconnectez-vous pour continuer à enrichir vos prospects.</strong>
                </p>
              )}
              
              <div className="space-y-1.5 text-xs text-green-800">
                {connectionInfo.linkedinEmail && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">📧 Compte:</span>
                    <span className="bg-white/60 px-2 py-0.5 rounded">{connectionInfo.linkedinEmail}</span>
                  </div>
                )}
                
                {connectionInfo.connectedBy && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">👤 Connecté par:</span>
                    <span>{connectionInfo.connectedBy}</span>
                  </div>
                )}
                
                {connectionInfo.connectedAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">🕐 Connecté le:</span>
                    <span>{formatDate(connectionInfo.connectedAt)}</span>
                  </div>
                )}
                
                {connectionInfo.lastUsedAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">⏱️ Dernière utilisation:</span>
                    <span>{formatDate(connectionInfo.lastUsedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <TestConnectionButton />
          <form action={disconnectAction} className="flex-1">
            {disconnectState.error && (
              <p className="text-red-500 text-sm mb-2">{disconnectState.error}</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              disabled={isDisconnectPending}
              className="w-full"
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

function TestConnectionButton() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/linkedin-connection/test', {
        method: 'POST',
      });

      const data = await response.json();
      
      // Ensure we always have a message (defensive programming)
      if (!data.message) {
        data.message = data.error || (data.success ? '✅ Test réussi' : '❌ Test échoué');
      }
      
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de test',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1">
      <Button
        type="button"
        variant="outline"
        onClick={handleTest}
        disabled={isTesting}
        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
      >
        {isTesting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Test en cours...
          </>
        ) : (
          <>
            <TestTube2 className="mr-2 h-4 w-4" />
            Tester la connexion
          </>
        )}
      </Button>

      {testResult && (
        <div className={`mt-2 rounded-lg p-3 text-sm ${
          testResult.success 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium mb-1">{testResult.message}</p>
              {testResult.details && (
                <div className="mt-2 space-y-1 text-xs bg-white/50 rounded p-2">
                  {testResult.success ? (
                    <>
                      <p><strong>Status API:</strong> {testResult.details.apiStatus}</p>
                      <p><strong>HTTP Status:</strong> {testResult.details.httpStatus}</p>
                      <p><strong>Profil test:</strong> {testResult.details.profileFetched}</p>
                      <p><strong>Crédits restants:</strong> {testResult.details.creditsRemaining}</p>
                      <p><strong>Rate limit:</strong> {testResult.details.rateLimit}</p>
                      <p><strong>Email LinkedIn:</strong> {testResult.details.linkedinEmail}</p>
                      <p><strong>Dernière utilisation:</strong> {
                        testResult.details.lastUsedAt 
                          ? new Date(testResult.details.lastUsedAt).toLocaleString('fr-FR')
                          : 'Jamais'
                      }</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Status HTTP:</strong> {testResult.details.httpStatus} - {testResult.details.httpStatusText}</p>
                      <p><strong>Erreur:</strong> {testResult.details.errorMessage}</p>
                      <p><strong>Email LinkedIn:</strong> {testResult.details.linkedinEmail}</p>
                      {testResult.details.possibleCauses && (
                        <div className="mt-2">
                          <strong>Causes possibles:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {testResult.details.possibleCauses.map((cause: string, i: number) => (
                              <li key={i}>{cause}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
