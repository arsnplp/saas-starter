'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { DeleteNodeButton } from './delete-node-button';

export function ConditionNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-gray-400 min-w-[280px] relative group">
      {data?.nodeId && <DeleteNodeButton nodeId={data.nodeId} onDelete={data?.onDelete} />}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-600" />
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg">
            <GitBranch className="w-5 h-5 text-gray-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">
            {data?.config?.question || 'Condition'}
          </div>
          <div className="text-xs text-gray-500">Les conditions sont vides</div>
        </div>
      </div>
      
      <div className="flex gap-2 mt-2">
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-medium text-green-600 px-2 py-1 bg-green-50 rounded">Oui</span>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="yes" 
            className="w-3 h-3 bg-green-500"
            style={{ left: '25%' }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-medium text-red-600 px-2 py-1 bg-red-50 rounded">Non</span>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="no" 
            className="w-3 h-3 bg-red-500"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    </div>
  );
}
