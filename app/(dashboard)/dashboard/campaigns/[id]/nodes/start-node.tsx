'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { startCampaignExecution } from '../campaign-execution';
import { toast } from 'sonner';

export function StartNode({ data }: NodeProps) {
  const [loading, setLoading] = useState(false);

  const handleStartCampaign = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!data.campaignId) {
      toast.error('ID de campagne manquant');
      return;
    }

    setLoading(true);
    try {
      const result = await startCampaignExecution(data.campaignId);
      
      if (result.success) {
        toast.success(result.message || 'Campagne démarrée');
        console.log('Plan d\'exécution:', result.executionPlan);
      } else {
        toast.error(result.error || 'Erreur lors du démarrage');
      }
    } catch (error) {
      console.error('Error starting campaign:', error);
      toast.error('Erreur lors du démarrage de la campagne');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-green-500 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-green-100 rounded-full">
          <Play className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">Début de séquence</div>
          <div className="text-xs text-gray-500">Point de départ</div>
        </div>
      </div>
      <button
        onClick={handleStartCampaign}
        disabled={loading}
        className="w-full mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            Démarrage...
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            Lancer la campagne
          </>
        )}
      </button>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500" />
    </div>
  );
}
