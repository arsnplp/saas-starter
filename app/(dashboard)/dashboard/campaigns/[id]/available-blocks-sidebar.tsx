'use client';

import { Mail, Info } from 'lucide-react';

export function AvailableBlocksSidebar() {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-base font-medium text-gray-900 mb-2">Blocs disponibles</h2>
      <p className="text-sm text-gray-500 mb-6">
        Glissez les blocs vers la zone de construction
      </p>

      <div className="space-y-3">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Bientôt disponible</p>
          </div>
          <p className="text-xs text-blue-700">
            Les blocs d'actions seront ajoutés prochainement. Vous pourrez alors construire des workflows complets.
          </p>
        </div>

        <div className="opacity-50 pointer-events-none">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Bloc Email</p>
                <p className="text-xs text-gray-500">Envoyer un email personnalisé</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t">
        <p className="text-xs text-gray-500 italic">
          Aucun bloc disponible
        </p>
      </div>
    </div>
  );
}
