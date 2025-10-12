import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import IcpForm from './icp-form';
import { getAllIcpProfiles, getIcpProfileById } from './actions';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function IcpPage({
  searchParams,
}: {
  searchParams: { icpId?: string };
}) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const allIcps = await getAllIcpProfiles(team.id);
  
  let selectedIcp = null;
  if (searchParams.icpId) {
    selectedIcp = await getIcpProfileById(team.id, Number(searchParams.icpId));
  }
  
  if (!selectedIcp && allIcps.length > 0) {
    selectedIcp = allIcps[0];
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
        Mon Prospect Idéal (ICP)
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Définissez les critères de votre client idéal. Ces informations seront utilisées pour 
        scorer automatiquement vos prospects via l'intelligence artificielle.
      </p>

      {selectedIcp && (
        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-orange-600">🎯</span> 
                ICP Sélectionné : {selectedIcp.name}
              </CardTitle>
              <Badge variant="default" className="bg-orange-500">Actif</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {selectedIcp.industries && (
                <div>
                  <span className="font-medium text-gray-700">Secteurs :</span>
                  <p className="text-gray-600">{selectedIcp.industries}</p>
                </div>
              )}
              {selectedIcp.buyerRoles && (
                <div>
                  <span className="font-medium text-gray-700">Postes :</span>
                  <p className="text-gray-600">{selectedIcp.buyerRoles}</p>
                </div>
              )}
              {selectedIcp.locations && (
                <div>
                  <span className="font-medium text-gray-700">Localisations :</span>
                  <p className="text-gray-600">{selectedIcp.locations}</p>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">Taille entreprise :</span>
                <p className="text-gray-600">{selectedIcp.companySizeMin} - {selectedIcp.companySizeMax} employés</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Score minimum :</span>
                <p className="text-gray-600">{selectedIcp.minScore}/100</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Langue :</span>
                <p className="text-gray-600">{selectedIcp.language.toUpperCase()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {selectedIcp ? 'Modifier le profil ICP' : 'Créer un nouveau profil ICP'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IcpForm teamId={team.id} existingIcp={selectedIcp} />
        </CardContent>
      </Card>

      {allIcps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Profils ICP créés ({allIcps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allIcps.map((icp) => (
                <Link
                  key={icp.id}
                  href={`/dashboard/icp?icpId=${icp.id}`}
                  className={`block p-4 rounded-lg border transition-all hover:shadow-md ${
                    selectedIcp?.id === icp.id
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{icp.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Créé le {new Date(icp.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    {selectedIcp?.id === icp.id && (
                      <Badge variant="default" className="bg-orange-500">Sélectionné</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {icp.industries && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {icp.industries.split(',').length} secteur(s)
                      </span>
                    )}
                    {icp.buyerRoles && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {icp.buyerRoles.split(',').length} poste(s)
                      </span>
                    )}
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      Score min: {icp.minScore}/100
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {allIcps.length === 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Commencez par créer votre premier profil ICP</strong> pour pouvoir scorer automatiquement vos prospects.
          </p>
        </div>
      )}
    </section>
  );
}
