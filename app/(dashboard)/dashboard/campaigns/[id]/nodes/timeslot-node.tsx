'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock3 } from 'lucide-react';

export function TimeSlotNode({ data }: NodeProps) {
  const getSlotText = () => {
    if (!data?.config?.hours || !data?.config?.days) return 'Non configuré';
    return `${data.config.hours.length} heures, ${data.config.days.length} jours`;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-pink-300 min-w-[240px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-pink-500" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center bg-pink-50 rounded-lg">
            <Clock3 className="w-5 h-5 text-pink-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">Créneau horaire</div>
          <div className="text-xs text-gray-500 truncate">{getSlotText()}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-pink-500" />
    </div>
  );
}
