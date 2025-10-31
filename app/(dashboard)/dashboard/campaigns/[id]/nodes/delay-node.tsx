'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { DeleteNodeButton } from './delete-node-button';

export function DelayNode({ data }: NodeProps) {
  const getDelayText = () => {
    if (!data?.config?.amount || !data?.config?.unit) return 'Non configuré';
    const unitText = data.config.unit === 'hours' ? 'heures' : data.config.unit === 'days' ? 'jours' : 'semaines';
    return `${data.config.amount} ${unitText}`;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-yellow-300 min-w-[240px] relative group">
      {data?.nodeId && <DeleteNodeButton nodeId={data.nodeId} onDelete={data?.onDelete} />}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-yellow-500" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center bg-yellow-50 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">Délai de {getDelayText()}</div>
          <div className="text-xs text-gray-500">Attente</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-yellow-500" />
    </div>
  );
}
