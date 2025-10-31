'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function StartNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-gray-300 min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">
          <Play className="w-4 h-4 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">Début de séquence</div>
          <div className="text-xs text-gray-500">Point de départ</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
}
