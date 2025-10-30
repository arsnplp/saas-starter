'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, GripVertical, Phone, ClipboardList, ArrowRightCircle, Clock, Calendar, Clock3 } from 'lucide-react';

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

  const getBlockInfo = () => {
    switch (block.type) {
      case 'email':
        return {
          icon: <Mail className="w-5 h-5 text-blue-600" />,
          name: 'Envoyer un mail',
          preview: block.config?.subject,
          bgColor: 'bg-blue-50',
          badgeColor: 'bg-blue-100 text-blue-600',
        };
      case 'call':
        return {
          icon: <Phone className="w-5 h-5 text-green-600" />,
          name: 'Appel',
          preview: block.config?.notes,
          bgColor: 'bg-green-50',
          badgeColor: 'bg-green-100 text-green-600',
        };
      case 'task':
        return {
          icon: <ClipboardList className="w-5 h-5 text-purple-600" />,
          name: 'Tâche manuelle',
          preview: block.config?.title,
          bgColor: 'bg-purple-50',
          badgeColor: 'bg-purple-100 text-purple-600',
        };
      case 'transfer':
        return {
          icon: <ArrowRightCircle className="w-5 h-5 text-orange-600" />,
          name: 'Envoyer à une campagne',
          preview: block.config?.targetCampaignId 
            ? `Campagne #${block.config.targetCampaignId}` 
            : 'Non configuré',
          bgColor: 'bg-orange-50',
          badgeColor: 'bg-orange-100 text-orange-600',
        };
      case 'delay':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-600" />,
          name: 'Attendre un délai fixe',
          preview: block.config?.amount && block.config?.unit
            ? `${block.config.amount} ${block.config.unit === 'hours' ? 'heures' : block.config.unit === 'days' ? 'jours' : 'semaines'}`
            : 'Non configuré',
          bgColor: 'bg-yellow-50',
          badgeColor: 'bg-yellow-100 text-yellow-600',
        };
      case 'waitUntil':
        return {
          icon: <Calendar className="w-5 h-5 text-indigo-600" />,
          name: 'Attendre jusqu\'à une date',
          preview: block.config?.waitUntil 
            ? new Date(block.config.waitUntil).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
            : 'Non configuré',
          bgColor: 'bg-indigo-50',
          badgeColor: 'bg-indigo-100 text-indigo-600',
        };
      case 'timeSlot':
        return {
          icon: <Clock3 className="w-5 h-5 text-pink-600" />,
          name: 'Attendre un créneau horaire',
          preview: block.config?.hours && block.config?.days
            ? `${block.config.hours.length} heures, ${block.config.days.length} jours`
            : 'Non configuré',
          bgColor: 'bg-pink-50',
          badgeColor: 'bg-pink-100 text-pink-600',
        };
      default:
        return {
          icon: <Mail className="w-5 h-5 text-blue-600" />,
          name: 'Bloc inconnu',
          preview: '',
          bgColor: 'bg-gray-50',
          badgeColor: 'bg-gray-100 text-gray-600',
        };
    }
  };

  const blockInfo = getBlockInfo();

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

        <div className={`flex items-center justify-center w-8 h-8 ${blockInfo.badgeColor} rounded-full text-sm font-medium flex-shrink-0`}>
          {index + 1}
        </div>

        <div className={`p-2 ${blockInfo.bgColor} rounded-lg`}>
          {blockInfo.icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">{blockInfo.name}</p>
          {blockInfo.preview && (
            <p className="text-sm text-gray-500 truncate">
              {blockInfo.preview}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
