import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LeadMagnetPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Lead Magnet
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Génération de leads filtrés et ciblés.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Recherche de leads filtrés</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Cette fonctionnalité sera bientôt disponible.</p>
        </CardContent>
      </Card>
    </section>
  );
}
