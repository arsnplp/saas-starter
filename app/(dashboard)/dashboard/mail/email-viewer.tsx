'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Reply, Trash2, Archive, MoreVertical } from 'lucide-react';
import ComposeEmail from './compose-email';

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
  body?: string;
}

interface EmailViewerProps {
  email: Email;
  onBack: () => void;
}

export default function EmailViewer({ email, onBack }: EmailViewerProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [fullEmail, setFullEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFullEmail(null);
    setIsLoading(true);
    
    const loadFullEmail = async () => {
      try {
        const response = await fetch(`/api/gmail/messages/${email.id}`);
        if (response.ok) {
          const data = await response.json();
          setFullEmail(data);
        }
      } catch (error) {
        console.error('Error loading full email:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFullEmail();
  }, [email.id]);

  function extractEmail(from: string) {
    const match = from.match(/<(.+?)>/);
    return match ? match[1] : from;
  }

  function extractName(from: string) {
    const match = from.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : from.split('<')[0].trim();
  }

  const displayEmail = fullEmail || email;

  return (
    <>
      {isReplying && (
        <ComposeEmail
          onClose={() => setIsReplying(false)}
          defaultTo={extractEmail(email.from)}
          defaultSubject={`Re: ${email.subject}`}
        />
      )}

      <Card className="h-full flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b p-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsReplying(true)}>
                <Reply className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Archive className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Email Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Subject */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {email.subject || '(Sans objet)'}
              </h1>

              {/* From/To Info */}
              <div className="flex items-start gap-4 mb-6 pb-6 border-b">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                  {extractName(email.from).charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {extractName(email.from)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {extractEmail(email.from)}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(email.date).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mt-2">
                    <span className="text-gray-500">à </span>
                    {email.to || 'moi'}
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="prose max-w-none">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-400">
                    Chargement du contenu complet...
                  </div>
                ) : displayEmail.body ? (
                  displayEmail.body.trim().startsWith('<') ? (
                    <div 
                      className="gmail-body"
                      dangerouslySetInnerHTML={{ __html: displayEmail.body }}
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#222',
                      }}
                    />
                  ) : (
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {displayEmail.body}
                    </div>
                  )
                ) : (
                  <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {displayEmail.snippet}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-t p-4 bg-gray-50">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsReplying(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Reply className="w-4 h-4 mr-2" />
                Répondre
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
