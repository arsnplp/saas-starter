import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LeadEspionForm from './lead-espion-form';
import { db } from '@/lib/db';
import { prospectFolders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function LeadEspionPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const folders = await db.query.prospectFolders.findMany({
    where: eq(prospectFolders.teamId, team.id),
    orderBy: (folders, { asc }) => [asc(folders.createdAt)],
  });

  if (folders.length === 0) {
    await db.insert(prospectFolders).values({
      teamId: team.id,
      name: 'Général',
      color: '#3b82f6',
      icon: 'inbox',
      isDefault: true,
    });
    
    const updatedFolders = await db.query.prospectFolders.findMany({
      where: eq(prospectFolders.teamId, team.id),
      orderBy: (folders, { asc }) => [asc(folders.createdAt)],
    });
    
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
            <LeadEspionForm teamId={team.id} folders={updatedFolders} />
          </CardContent>
        </Card>
      </section>
    );
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
          <LeadEspionForm teamId={team.id} folders={folders} />
        </CardContent>
      </Card>
    </section>
  );
}
