'use client';

import { useDraggable } from '@dnd-kit/core';
import { Phone } from 'lucide-react';

export function DraggableCallBlock() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'call-block-draggable',
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-green-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-50 rounded-lg">
          <Phone className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">Appel</p>
          <p className="text-xs text-gray-500">
            Créer une tâche d'appel manuel
          </p>
        </div>
      </div>
    </div>
  );
}
