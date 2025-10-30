'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Mail } from 'lucide-react';
import { WorkflowBlockCard } from './workflow-block-card';

type WorkflowBlock = {
  id: number;
  type: string;
  config: any;
  order: number;
};

type DraggableWorkflowAreaProps = {
  campaignId: number;
  blocks: WorkflowBlock[];
  onBlockClick: (block: WorkflowBlock) => void;
};

export function DraggableWorkflowArea({
  campaignId,
  blocks,
  onBlockClick,
}: DraggableWorkflowAreaProps) {
  const { setNodeRef } = useDroppable({
    id: 'workflow-area',
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex-1 min-h-[400px] p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50"
    >
      {blocks.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-white rounded-full mb-4 shadow-sm">
            <Mail className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Aucun bloc ajouté
          </h3>
          <p className="text-xs text-gray-500 max-w-sm">
            Glissez des blocs depuis la sidebar de droite pour construire votre séquence
          </p>
        </div>
      ) : (
        <SortableContext items={blocks.map((b) => b.id.toString())} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((block, index) => (
              <WorkflowBlockCard
                key={block.id}
                block={block}
                index={index}
                onClick={() => onBlockClick(block)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
