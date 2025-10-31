'use client';

import { useDraggable } from '@dnd-kit/core';
import { MessageSquare } from 'lucide-react';

export function DraggableLinkedInMessageBlock() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'linkedin-message-block-draggable',
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('blockType', 'linkedInMessage');
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
      className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-cyan-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-50 rounded-lg">
          <MessageSquare className="w-5 h-5 text-cyan-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">Message LinkedIn</p>
          <p className="text-xs text-gray-500">
            Envoyer un message privé sur LinkedIn
          </p>
        </div>
      </div>
    </div>
  );
}
