import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import IcpForm from './icp-form';
import { getIcpProfile } from './actions';

export default async function IcpPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const existingIcp = await getIcpProfile(team.id);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
        Mon Prospect Idéal (ICP)
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Définissez les critères de votre client idéal. Ces informations seront utilisées pour 
        scorer automatiquement vos prospects via l'intelligence artificielle.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Critères du Prospect Idéal</CardTitle>
        </CardHeader>
        <CardContent>
          <IcpForm teamId={team.id} existingIcp={existingIcp} />
        </CardContent>
      </Card>

      {existingIcp && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Prochaine étape :</strong> Une fois vos critères définis, chaque nouveau prospect 
            sera automatiquement analysé et scoré par l'IA selon ces critères.
          </p>
        </div>
      )}
    </section>
  );
}
