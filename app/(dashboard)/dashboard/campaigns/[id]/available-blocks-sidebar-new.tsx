'use client';

import { DraggableEmailBlock } from './draggable-email-block';
import { DraggableCallBlock } from './draggable-call-block';
import { DraggableTaskBlock } from './draggable-task-block';
import { DraggableTransferBlock } from './draggable-transfer-block';
import { DraggableDelayBlock } from './draggable-delay-block';
import { DraggableWaitUntilBlock } from './draggable-waituntil-block';
import { DraggableTimeSlotBlock } from './draggable-timeslot-block';
import { DraggableConditionBlock } from './draggable-condition-block';
import { DraggableVisitLinkedInBlock } from './draggable-visit-linkedin-block';
import { DraggableAddConnectionBlock } from './draggable-add-connection-block';
import { DraggableLinkedInMessageBlock } from './draggable-linkedin-message-block';

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
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Actions</h3>
          <DraggableEmailBlock />
          <DraggableCallBlock />
          <DraggableTaskBlock />
          <DraggableTransferBlock />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">LinkedIn</h3>
          <DraggableVisitLinkedInBlock />
          <DraggableAddConnectionBlock />
          <DraggableLinkedInMessageBlock />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Timing</h3>
          <DraggableDelayBlock />
          <DraggableWaitUntilBlock />
          <DraggableTimeSlotBlock />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Logique</h3>
          <DraggableConditionBlock />
        </div>
      </div>
    </div>
  );
}
