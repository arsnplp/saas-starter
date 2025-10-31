'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Calendar } from 'lucide-react';
import { DeleteNodeButton } from './delete-node-button';

export function WaitUntilNode({ data }: NodeProps) {
  const getDateText = () => {
    if (!data?.config?.waitUntil) return 'Non configuré';
    return new Date(data.config.waitUntil).toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'short' 
    });
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-indigo-300 min-w-[240px] relative group">
      {data?.nodeId && <DeleteNodeButton nodeId={data.nodeId} onDelete={data?.onDelete} />}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center bg-indigo-50 rounded-lg">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">Attendre jusqu'au</div>
          <div className="text-xs text-gray-500 truncate">{getDateText()}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
}
