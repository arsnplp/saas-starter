'use client';

import { useDraggable } from '@dnd-kit/core';
import { GitBranch } from 'lucide-react';

export function DraggableConditionBlock() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'condition-block-draggable',
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('blockType', 'condition');
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
      className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg">
          <GitBranch className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">Condition (Oui/Non)</p>
          <p className="text-xs text-gray-500">
            Créer une branche conditionnelle
          </p>
        </div>
      </div>
    </div>
  );
}
