'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, RefreshCw, Inbox, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ComposeEmail from './compose-email';

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
}

export default function MailboxClient({ teamId, googleEmail }: { teamId: number; googleEmail: string }) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gmail/messages');
      if (response.ok) {
        const data = await response.json();
        setEmails(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadEmails();
    setIsRefreshing(false);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
  }

  function extractName(from: string) {
    const match = from.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : from.split('<')[0].trim();
  }

  function isUnread(labelIds: string[]) {
    return labelIds.includes('UNREAD');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {isComposing && (
        <ComposeEmail onClose={() => setIsComposing(false)} />
      )}
      
      <div className="mb-4">
        <Button
          onClick={() => setIsComposing(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Inbox className="w-5 h-5" />
                  Boîte de réception
                </h2>
                <Button
                  onClick={handleRefresh}
                  size="sm"
                  variant="ghost"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>

            <div className="space-y-2">
              {emails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun email</p>
                </div>
              ) : (
                emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                      selectedEmail?.id === email.id ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
                    } ${isUnread(email.labelIds) ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-sm ${isUnread(email.labelIds) ? 'font-semibold' : 'font-normal'} truncate`}>
                        {extractName(email.from)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">
                      {email.subject || '(Sans objet)'}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {email.snippet}
                    </div>
                    {isUnread(email.labelIds) && (
                      <div className="mt-1">
                        <Badge variant="default" className="text-xs bg-blue-500">
                          Non lu
                        </Badge>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-6">
            {selectedEmail ? (
              <div>
                <div className="border-b pb-4 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {selectedEmail.subject || '(Sans objet)'}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">De:</span>
                    <span>{selectedEmail.from}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(selectedEmail.date).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="prose max-w-none">
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {selectedEmail.snippet}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Sélectionnez un email pour le lire</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
