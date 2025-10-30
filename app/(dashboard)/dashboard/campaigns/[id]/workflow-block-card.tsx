'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, GripVertical } from 'lucide-react';

type WorkflowBlockCardProps = {
  block: {
    id: number;
    type: string;
    config: any;
    order: number;
  };
  index: number;
  onClick: () => void;
};

export function WorkflowBlockCard({ block, index, onClick }: WorkflowBlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium flex-shrink-0">
          {index + 1}
        </div>

        <div className="p-2 bg-blue-50 rounded-lg">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">Bloc Email</p>
          {block.config?.subject && (
            <p className="text-sm text-gray-500 truncate">
              {block.config.subject}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
