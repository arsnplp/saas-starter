'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { LinkedInOAuthService } from '@/lib/services/linkedin-oauth';

interface OAuthConnectionInfo {
  isConnected: boolean;
  connectedAt: string | null;
  connectedBy: string | null;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  isExpiringSoon: boolean;
}

export default function LinkedinOAuthForm() {
  const [connectionInfo, setConnectionInfo] = useState<OAuthConnectionInfo>({
    isConnected: false,
    connectedAt: null,
    connectedBy: null,
    expiresAt: null,
    lastRefreshedAt: null,
    isExpiringSoon: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/linkedin-oauth/status');
      if (response.ok) {
        const data = await response.json();
        setConnectionInfo(data);
      }
    } catch (error) {
      console.error('Error checking OAuth connection:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/auth/linkedin/start', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        const checkInterval = setInterval(async () => {
          const statusResponse = await fetch('/api/linkedin-oauth/status');
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.isConnected) {
              setConnectionInfo(statusData);
              clearInterval(checkInterval);
              setIsConnecting(false);
            }
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(checkInterval);
          setIsConnecting(false);
        }, 120000);
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Voulez-vous vraiment déconnecter votre compte LinkedIn OAuth ?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/linkedin-oauth/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setConnectionInfo({
          isConnected: false,
          connectedAt: null,
          connectedBy: null,
          expiresAt: null,
          lastRefreshedAt: null,
          isExpiringSoon: false,
        });
      }
    } catch (error) {
      console.error('Error disconnecting OAuth:', error);
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
                {connectionInfo.isExpiringSoon ? '⚠️ Token LinkedIn OAuth expire bientôt' : '✅ API LinkedIn OAuth connectée'}
              </p>
              
              <div className={`space-y-1.5 text-xs ${connectionInfo.isExpiringSoon ? 'text-yellow-800' : 'text-green-800'}`}>
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
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconnexion...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Reconnecter
                </>
              )}
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
              'Déconnecter OAuth'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Connectez votre compte LinkedIn via OAuth pour accéder à l'API LinkedIn officielle et utiliser les fonctionnalités avancées.
      </p>

      <Button
        onClick={handleConnect}
        className="w-full"
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connexion en cours...
          </>
        ) : (
          <>
            <ExternalLink className="mr-2 h-4 w-4" />
            Connecter avec LinkedIn OAuth
          </>
        )}
      </Button>

      {isConnecting && (
        <p className="text-xs text-gray-500 text-center">
          Une fenêtre popup s'est ouverte. Autorisez l'accès puis revenez ici.
        </p>
      )}
    </div>
  );
}
