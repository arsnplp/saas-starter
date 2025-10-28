import { Suspense } from 'react';
import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import LinkedinConnectionForm from './linkedin-connection-form';
import LinkedinOAuthForm from './linkedin-oauth-form';
import GmailConnectionForm from './gmail-connection-form';
import ApiKeyForm from './api-key-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Linkedin, Key, Mail, Puzzle } from 'lucide-react';
import { getApiKey } from './api-key-actions';

export default async function IntegrationsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const apiKeyData = await getApiKey();

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Intégrations
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Puzzle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Clé API Extension Chrome</CardTitle>
                <CardDescription>
                  Générez une clé API pour permettre à votre extension Chrome d'importer des prospects automatiquement
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ApiKeyForm initialData={apiKeyData.success ? { exists: apiKeyData.exists || false, apiKey: apiKeyData.apiKey } : { exists: false }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Linkedin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Connexion LinkedIn (LinkUp)</CardTitle>
                <CardDescription>
                  Connectez votre compte LinkedIn pour enrichir automatiquement les profils de vos prospects via LinkUp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Chargement...</div>}>
              <LinkedinConnectionForm />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>API LinkedIn OAuth</CardTitle>
                <CardDescription>
                  Connectez votre compte via OAuth pour accéder à l'API LinkedIn officielle et utiliser les fonctionnalités avancées
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Chargement...</div>}>
              <LinkedinOAuthForm />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Mail className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <CardTitle>Gmail</CardTitle>
                <CardDescription>
                  Connectez votre boîte mail Gmail pour accéder à vos emails et envoyer des messages directement depuis l'application
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Chargement...</div>}>
              <GmailConnectionForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
