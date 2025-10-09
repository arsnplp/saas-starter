import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LeadFroidPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Lead Froid
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Recherche de leads basée sur votre Profil Client Idéal (ICP).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Recherche de leads froids</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Cette fonctionnalité sera bientôt disponible.</p>
        </CardContent>
      </Card>
    </section>
  );
}
