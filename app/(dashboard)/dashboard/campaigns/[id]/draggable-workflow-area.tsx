'use client';

import { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Mail, GripVertical } from 'lucide-react';
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
  onBlocksReorder: (blocks: WorkflowBlock[]) => void;
  onBlockAdd: (type: string) => void;
};

export function DraggableWorkflowArea({
  campaignId,
  blocks,
  onBlockClick,
  onBlocksReorder,
  onBlockAdd,
}: DraggableWorkflowAreaProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over) {
      if (active.id === 'email-block-draggable') {
        onBlockAdd('email');
      }
      setActiveId(null);
      return;
    }

    if (active.id === 'email-block-draggable') {
      onBlockAdd('email');
    } else if (active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id.toString() === active.id);
      const newIndex = blocks.findIndex((b) => b.id.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(blocks, oldIndex, newIndex);
        onBlocksReorder(reordered);
      }
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 min-h-[400px] p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
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

      <DragOverlay>
        {activeId ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg p-4 shadow-lg opacity-90">
            <div className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Bloc Email</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
