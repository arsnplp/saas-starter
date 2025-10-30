'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, Users, Mail, GripVertical, Phone, ClipboardList, ArrowRightCircle, Clock, Calendar, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
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
    try {
      let result;

      switch (type) {
        case 'email':
          result = await createEmailBlock(campaignId, {
            subject: 'Nouveau message',
            body: 'Bonjour {{name}},\n\nVotre message ici...',
          });
          break;

        case 'call':
          const { createBlock } = await import('./block-actions');
          result = await createBlock(campaignId, 'call', {
            notes: 'Points à discuter lors de l\'appel...',
            deadline: '',
          });
          break;

        case 'task':
          const { createBlock: createTaskBlock } = await import('./block-actions');
          result = await createTaskBlock(campaignId, 'task', {
            title: 'Nouvelle tâche',
            description: '',
            deadline: '',
          });
          break;

        case 'transfer':
          const { createBlock: createTransferBlock } = await import('./block-actions');
          result = await createTransferBlock(campaignId, 'transfer', {
            targetCampaignId: 0,
            delay: 0,
          });
          break;

        case 'delay':
          const { createBlock: createDelayBlock } = await import('./block-actions');
          result = await createDelayBlock(campaignId, 'delay', {
            amount: 2,
            unit: 'days',
          });
          break;

        case 'waitUntil':
          const { createBlock: createWaitUntilBlock } = await import('./block-actions');
          result = await createWaitUntilBlock(campaignId, 'waitUntil', {
            waitUntil: '',
          });
          break;

        case 'timeSlot':
          const { createBlock: createTimeSlotBlock } = await import('./block-actions');
          result = await createTimeSlotBlock(campaignId, 'timeSlot', {
            hours: [9, 10, 11, 14, 15, 16],
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          });
          break;

        default:
          return;
      }

      if (result?.success) {
        toast.success('Bloc ajouté');
        await loadData();
        if (result.block) {
          setSelectedBlock(result.block);
        }
      } else {
        toast.error(result?.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
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

    const blockTypeMap: Record<string, string> = {
      'email-block-draggable': 'email',
      'call-block-draggable': 'call',
      'task-block-draggable': 'task',
      'transfer-block-draggable': 'transfer',
      'delay-block-draggable': 'delay',
      'waituntil-block-draggable': 'waitUntil',
      'timeslot-block-draggable': 'timeSlot',
    };

    const blockType = blockTypeMap[active.id];
    if (blockType) {
      handleBlockAdd(blockType);
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
        {activeId ? (() => {
          const blockTypeMap: Record<string, { icon: JSX.Element; name: string; color: string }> = {
            'email-block-draggable': {
              icon: <Mail className="w-5 h-5 text-blue-600" />,
              name: 'Envoyer un mail',
              color: 'border-blue-500',
            },
            'call-block-draggable': {
              icon: <Phone className="w-5 h-5 text-green-600" />,
              name: 'Appel',
              color: 'border-green-500',
            },
            'task-block-draggable': {
              icon: <ClipboardList className="w-5 h-5 text-purple-600" />,
              name: 'Tâche manuelle',
              color: 'border-purple-500',
            },
            'transfer-block-draggable': {
              icon: <ArrowRightCircle className="w-5 h-5 text-orange-600" />,
              name: 'Envoyer à une campagne',
              color: 'border-orange-500',
            },
            'delay-block-draggable': {
              icon: <Clock className="w-5 h-5 text-yellow-600" />,
              name: 'Attendre un délai fixe',
              color: 'border-yellow-500',
            },
            'waituntil-block-draggable': {
              icon: <Calendar className="w-5 h-5 text-indigo-600" />,
              name: 'Attendre jusqu\'à une date',
              color: 'border-indigo-500',
            },
            'timeslot-block-draggable': {
              icon: <Clock3 className="w-5 h-5 text-pink-600" />,
              name: 'Attendre un créneau horaire',
              color: 'border-pink-500',
            },
          };

          const draggedBlock = blocks.find(b => b.id.toString() === activeId);
          let blockInfo = blockTypeMap[activeId];

          if (draggedBlock) {
            switch (draggedBlock.type) {
              case 'email':
                blockInfo = blockTypeMap['email-block-draggable'];
                break;
              case 'call':
                blockInfo = blockTypeMap['call-block-draggable'];
                break;
              case 'task':
                blockInfo = blockTypeMap['task-block-draggable'];
                break;
              case 'transfer':
                blockInfo = blockTypeMap['transfer-block-draggable'];
                break;
              case 'delay':
                blockInfo = blockTypeMap['delay-block-draggable'];
                break;
              case 'waitUntil':
                blockInfo = blockTypeMap['waituntil-block-draggable'];
                break;
              case 'timeSlot':
                blockInfo = blockTypeMap['timeslot-block-draggable'];
                break;
            }
          }

          if (!blockInfo) {
            blockInfo = blockTypeMap['email-block-draggable'];
          }

          return (
            <div className={`bg-white border-2 ${blockInfo.color} rounded-lg p-4 shadow-lg opacity-90`}>
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-400" />
                {blockInfo.icon}
                <span className="font-medium text-gray-900">{blockInfo.name}</span>
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}
