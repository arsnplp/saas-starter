'use client';

import { useDraggable } from '@dnd-kit/core';
import { Calendar } from 'lucide-react';

export function DraggableWaitUntilBlock() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'waituntil-block-draggable',
    data: { type: 'waitUntil' },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('blockType', 'waitUntil');
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
      className="bg-white border-2 border-indigo-200 rounded-lg p-3 hover:border-indigo-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Calendar className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 text-sm">Attendre jusqu'à une date</h3>
          <p className="text-xs text-gray-500">Date et heure précises</p>
        </div>
      </div>
    </div>
  );
}
