import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db/drizzle';
import { icpProfiles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import LeadFroidForm from './lead-froid-form';

export default async function LeadFroidPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  // Récupérer les ICPs de l'équipe
  const icps = await db.query.icpProfiles.findMany({
    where: eq(icpProfiles.teamId, team.id),
    orderBy: desc(icpProfiles.createdAt),
  });

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Lead Froid
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Recherchez des profils LinkedIn qui correspondent à votre ICP (Ideal Customer Profile). 
        Générez automatiquement une liste de prospects qualifiés.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher des profils par ICP</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadFroidForm teamId={team.id} icps={icps} />
        </CardContent>
      </Card>
    </section>
  );
}
