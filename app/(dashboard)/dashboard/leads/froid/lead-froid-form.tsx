'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Search } from 'lucide-react';
import { searchLeadsByICP } from '../actions';

type ICP = {
  id: number;
  name: string;
  buyerRoles: string | null;
  industries: string | null;
  locations: string | null;
  keywordsInclude: string | null;
  companySizeMin: number | null;
  companySizeMax: number | null;
};

type LeadFroidFormProps = {
  teamId: number;
  icps: ICP[];
};

export default function LeadFroidForm({ teamId, icps }: LeadFroidFormProps) {
  const [selectedIcpId, setSelectedIcpId] = useState<number>(icps[0]?.id || 0);
  const [totalResults, setTotalResults] = useState(20);
  const [state, formAction, isPending] = useActionState(searchLeadsByICP, null);

  const selectedIcp = icps.find(icp => icp.id === selectedIcpId);
  const error = state?.error;
  
  let success = '';
  if (state?.count !== undefined) {
    if (state.count === 0) {
      const rangeInfo = state.range ? ` (profils ${state.range} déjà importés)` : '';
      success = `Recherche effectuée : tous les profils trouvés sont déjà dans vos prospects${rangeInfo}`;
    } else {
      const rangeInfo = state.range ? ` - Profils ${state.range}` : '';
      const totalInfo = state.totalAvailable ? ` sur ${state.totalAvailable} disponibles` : '';
      const strategyInfo = state.strategyMessage || '';
      success = `${state.count} nouveau${state.count > 1 ? 'x' : ''} prospect${state.count > 1 ? 's' : ''} importé${state.count > 1 ? 's' : ''}${rangeInfo}${totalInfo}${strategyInfo} !`;
    }
  }

  if (icps.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          Vous devez d'abord créer un ICP avant de pouvoir rechercher des leads froids.
        </p>
        <a href="/dashboard/icp" className="text-sm text-yellow-900 underline hover:no-underline mt-2 inline-block">
          Créer un ICP →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="icpId" value={selectedIcpId} />
        <input type="hidden" name="totalResults" value={totalResults} />

        <div>
          <Label htmlFor="icpSelect">Sélectionner un ICP</Label>
          <select
            id="icpSelect"
            value={selectedIcpId}
            onChange={(e) => setSelectedIcpId(Number(e.target.value))}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
              </option>
            ))}
          </select>
        </div>

        {selectedIcp && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Critères de recherche :</h4>
            {selectedIcp.buyerRoles && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Métiers :</span> {selectedIcp.buyerRoles}
              </p>
            )}
            {selectedIcp.locations && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Localisation :</span> {selectedIcp.locations}
              </p>
            )}
            {selectedIcp.industries && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Secteurs :</span> {selectedIcp.industries}
              </p>
            )}
            {selectedIcp.keywordsInclude && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Mots-clés :</span> {selectedIcp.keywordsInclude}
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="totalResults">Nombre de profils à rechercher</Label>
          <select
            id="totalResults"
            value={totalResults}
            onChange={(e) => setTotalResults(Number(e.target.value))}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value={10}>10 profils (1 crédit)</option>
            <option value={20}>20 profils (2 crédits)</option>
            <option value={50}>50 profils (5 crédits)</option>
            <option value={100}>100 profils (10 crédits)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Coût LinkUp : 1 crédit par tranche de 10 profils
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recherche en cours...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Lancer la recherche
            </>
          )}
        </Button>
      </form>

      {state?.prospects && state.prospects.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">
            {state.prospects.length} profil{state.prospects.length > 1 ? 's' : ''} trouvé{state.prospects.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {state.prospects.slice(0, 10).map((prospect: any, index: number) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
              >
                {prospect.profilePictureUrl ? (
                  <img
                    src={prospect.profilePictureUrl}
                    alt={prospect.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{prospect.name}</p>
                  {prospect.title && (
                    <p className="text-xs text-gray-600 mt-1">{prospect.title}</p>
                  )}
                  {prospect.location && (
                    <p className="text-xs text-gray-500 mt-1">📍 {prospect.location}</p>
                  )}
                  <a
                    href={prospect.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600 mt-1 inline-block"
                  >
                    Voir le profil →
                  </a>
                </div>
              </div>
            ))}
            {state.prospects.length > 10 && (
              <p className="text-sm text-gray-500 text-center pt-2">
                ... et {state.prospects.length - 10} autres profils
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
