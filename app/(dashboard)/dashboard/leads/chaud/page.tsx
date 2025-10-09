import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LeadChaudForm from './lead-chaud-form';

export default async function LeadChaudPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Lead Chaud
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Récupérez les leads depuis vos propres posts LinkedIn. 
        Entrez le lien d'un de vos posts pour voir qui a réagi ou commenté.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Importer des leads depuis votre post</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadChaudForm teamId={teamData.team.id} />
        </CardContent>
      </Card>
    </section>
  );
}
