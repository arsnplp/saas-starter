'use client';

import { useDraggable } from '@dnd-kit/core';
import { Clock } from 'lucide-react';

export function DraggableDelayBlock() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'delay-block-draggable',
    data: { type: 'delay' },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('blockType', 'delay');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      draggable
      onDragStart={handleDragStart}
      className="bg-white border-2 border-yellow-200 rounded-lg p-3 hover:border-yellow-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-yellow-50 rounded-lg">
          <Clock className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 text-sm">Attendre un délai fixe</h3>
          <p className="text-xs text-gray-500">Pause de X jours/heures</p>
        </div>
      </div>
    </div>
  );
}
