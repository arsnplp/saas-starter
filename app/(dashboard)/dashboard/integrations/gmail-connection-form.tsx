'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Mail } from 'lucide-react';

interface GmailConnectionInfo {
  isConnected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  isExpiringSoon: boolean;
}

export default function GmailConnectionForm() {
  const [connectionInfo, setConnectionInfo] = useState<GmailConnectionInfo>({
    isConnected: false,
    googleEmail: null,
    connectedAt: null,
    connectedBy: null,
    expiresAt: null,
    lastRefreshedAt: null,
    isExpiringSoon: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gmail/status');
      if (response.ok) {
        const data = await response.json();
        setConnectionInfo(data);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = '/oauth/google';
  }

  async function handleDisconnect() {
    if (!confirm('Voulez-vous vraiment déconnecter votre compte Gmail ?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/gmail/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setConnectionInfo({
          isConnected: false,
          googleEmail: null,
          connectedAt: null,
          connectedBy: null,
          expiresAt: null,
          lastRefreshedAt: null,
          isExpiringSoon: false,
        });
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
    } finally {
      setIsLoading(false);
    }
  }

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

  if (connectionInfo.isConnected) {
    return (
      <div className="space-y-4">
        <div className={`border rounded-lg p-4 ${connectionInfo.isExpiringSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start gap-3">
            <CheckCircle className={`w-5 h-5 mt-0.5 ${connectionInfo.isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium mb-2 ${connectionInfo.isExpiringSoon ? 'text-yellow-900' : 'text-green-900'}`}>
                {connectionInfo.isExpiringSoon ? '⚠️ Token Gmail expire bientôt' : '✅ Gmail connecté'}
              </p>
              
              <div className={`space-y-1.5 text-xs ${connectionInfo.isExpiringSoon ? 'text-yellow-800' : 'text-green-800'}`}>
                {connectionInfo.googleEmail && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">📧 Compte:</span>
                    <span>{connectionInfo.googleEmail}</span>
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

                {connectionInfo.expiresAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">⏰ Expire le:</span>
                    <span>{formatDate(connectionInfo.expiresAt)}</span>
                  </div>
                )}

                {connectionInfo.lastRefreshedAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">🔄 Dernier refresh:</span>
                    <span>{formatDate(connectionInfo.lastRefreshedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {connectionInfo.isExpiringSoon && (
            <Button
              onClick={handleConnect}
              variant="default"
              size="sm"
            >
              <Mail className="mr-2 h-4 w-4" />
              Reconnecter
            </Button>
          )}
          
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Déconnexion...
              </>
            ) : (
              'Déconnecter'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Connectez votre compte Gmail pour accéder à votre boîte mail et envoyer des emails directement depuis l'application.
      </p>

      <Button
        onClick={handleConnect}
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connexion...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Connecter avec Google
          </>
        )}
      </Button>
    </div>
  );
}
