import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LeadEspionForm from './lead-espion-form';

export default async function LeadEspionPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Lead Espion
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Récupérez les leads depuis les posts LinkedIn de vos concurrents. 
        Entrez le lien d'un post pour voir qui a réagi ou commenté.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Importer des leads depuis un post concurrent</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadEspionForm teamId={team.id} />
        </CardContent>
      </Card>
    </section>
  );
}
