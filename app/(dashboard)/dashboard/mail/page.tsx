import { Suspense } from 'react';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import MailboxClient from './mailbox-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { gmailConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function MailPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const connection = await db.query.gmailConnections.findFirst({
    where: eq(gmailConnections.teamId, team.id),
  });

  if (!connection || !connection.isActive) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
          Boîte Mail
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Gmail non connecté
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Vous devez d'abord connecter votre compte Gmail pour accéder à votre boîte mail.
            </p>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Aller aux intégrations
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900">
          Boîte Mail
        </h1>
        <div className="text-sm text-gray-600">
          {connection.googleEmail}
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-8">Chargement des emails...</div>}>
        <MailboxClient teamId={team.id} googleEmail={connection.googleEmail} />
      </Suspense>
    </section>
  );
}
