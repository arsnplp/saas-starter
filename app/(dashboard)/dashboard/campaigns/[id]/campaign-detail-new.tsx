'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, Users } from 'lucide-react';
import Link from 'next/link';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Mail, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FolderSelectorCompact } from './folder-selector-compact';
import { DraggableWorkflowArea } from './draggable-workflow-area';
import { AvailableBlocksSidebarNew } from './available-blocks-sidebar-new';
import { BlockConfigModal } from './block-config-modal';
import { getCampaignBlocks, createEmailBlock, reorderBlocks } from './block-actions';
import { getCampaignWithDetails } from './actions';
import { toast } from 'sonner';

type CampaignDetailNewProps = {
  campaignId: number;
};

export function CampaignDetailNew({ campaignId }: CampaignDetailNewProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignResult, blocksResult] = await Promise.all([
        getCampaignWithDetails(campaignId),
        getCampaignBlocks(campaignId),
      ]);

      if (campaignResult.success && campaignResult.campaign) {
        setCampaign(campaignResult.campaign);
      }

      if (blocksResult.success && blocksResult.blocks) {
        setBlocks(blocksResult.blocks);
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const handleBlockAdd = async (type: string) => {
    if (type === 'email') {
      try {
        const result = await createEmailBlock(campaignId, {
          subject: 'Nouveau message',
          body: 'Bonjour {{name}},\n\nVotre message ici...',
        });

        if (result.success) {
          toast.success('Bloc ajouté');
          await loadData();
          if (result.block) {
            setSelectedBlock(result.block);
          }
        } else {
          toast.error(result.error || 'Erreur');
        }
      } catch (error) {
        toast.error('Une erreur est survenue');
      }
    }
  };

  const handleBlocksReorder = async (reorderedBlocks: any[]) => {
    const blockIds = reorderedBlocks.map(b => b.id);
    setBlocks(reorderedBlocks);

    try {
      const result = await reorderBlocks(campaignId, blockIds);
      if (!result.success) {
        toast.error(result.error || 'Erreur lors du réordonnancement');
        await loadData();
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
      await loadData();
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    if (active.id === 'email-block-draggable') {
      handleBlockAdd('email');
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id.toString() === active.id);
      const newIndex = blocks.findIndex((b) => b.id.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(blocks, oldIndex, newIndex);
        handleBlocksReorder(reordered);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Campagne non trouvée</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 flex flex-col h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/campaigns"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-lg font-medium text-gray-900">{campaign.name}</h1>
                {campaign.description && (
                  <p className="text-sm text-gray-500">{campaign.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{campaign.prospectCount || 0} prospects</span>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                campaign.isActive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {campaign.isActive ? (
                  <>
                    <Play className="w-3 h-3" />
                    Active
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    Inactive
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <FolderSelectorCompact campaignId={campaignId} onUpdate={loadData} />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-4">
                <h2 className="text-base font-medium text-gray-900 mb-1">
                  Séquence d'actions
                </h2>
                <p className="text-sm text-gray-500">
                  Glissez des blocs depuis la sidebar pour construire votre workflow
                </p>
              </div>

              <DraggableWorkflowArea
                campaignId={campaignId}
                blocks={blocks}
                onBlockClick={setSelectedBlock}
              />
            </div>
          </div>

          <AvailableBlocksSidebarNew />
        </div>

        <BlockConfigModal
          block={selectedBlock}
          campaignId={campaignId}
          onClose={() => setSelectedBlock(null)}
          onSuccess={loadData}
        />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg p-4 shadow-lg opacity-90">
            <div className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Envoyer un mail</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
