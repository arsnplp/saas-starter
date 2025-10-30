'use client';

import { useDraggable } from '@dnd-kit/core';
import { Clock3 } from 'lucide-react';

export function DraggableTimeSlotBlock() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'timeslot-block-draggable',
    data: { type: 'timeSlot' },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white border-2 border-pink-200 rounded-lg p-3 hover:border-pink-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-pink-50 rounded-lg">
          <Clock3 className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 text-sm">Attendre un créneau horaire</h3>
          <p className="text-xs text-gray-500">Heures et jours spécifiques</p>
        </div>
      </div>
    </div>
  );
}
