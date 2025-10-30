'use client';

import { Info } from 'lucide-react';
import { DraggableEmailBlock } from './draggable-email-block';

export function AvailableBlocksSidebarNew() {
  return (
    <div className="w-80 bg-white border-l p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-base font-medium text-gray-900 mb-2">
          Blocs disponibles
        </h2>
        <p className="text-xs text-gray-500">
          Glissez les blocs vers la zone de construction
        </p>
      </div>

      <div className="space-y-3">
        <DraggableEmailBlock />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-blue-900 font-medium mb-1">
                Plus de blocs bientôt
              </p>
              <p className="text-xs text-blue-700">
                Délais, conditions, webhooks... D'autres types de blocs seront ajoutés prochainement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
