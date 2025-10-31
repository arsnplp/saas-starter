'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Phone } from 'lucide-react';

export function CallNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-green-300 min-w-[240px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-green-500" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center bg-green-50 rounded-lg">
            <Phone className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">Appel</div>
          {data?.config?.notes && (
            <div className="text-xs text-gray-500 truncate">{data.config.notes}</div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500" />
    </div>
  );
}
