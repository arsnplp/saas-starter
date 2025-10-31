'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Play, Pause, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FolderSelectorCompact } from './folder-selector-compact';
import { WorkflowCanvas } from './workflow-canvas';
import { AvailableBlocksSidebarNew } from './available-blocks-sidebar-new';
import { BlockConfigModal } from './block-config-modal';
import { getCampaignWithDetails } from './actions';
import { getWorkflowData, createWorkflowNode, updateNodePositions, createWorkflowEdge } from './workflow-actions';
import { migrateBlocksToWorkflow } from './migrate-to-workflow';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';

type CampaignDetailWorkflowProps = {
  campaignId: number;
};

export function CampaignDetailWorkflow({ campaignId }: CampaignDetailWorkflowProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignResult, workflowResult] = await Promise.all([
        getCampaignWithDetails(campaignId),
        getWorkflowData(campaignId),
      ]);

      if (campaignResult.success && campaignResult.campaign) {
        setCampaign(campaignResult.campaign);
      }

      if (workflowResult.success && workflowResult.nodes && workflowResult.edges) {
        if (workflowResult.nodes.length === 0) {
          const migrationResult = await migrateBlocksToWorkflow(campaignId);
          if (migrationResult.success) {
            const updatedWorkflow = await getWorkflowData(campaignId);
            if (updatedWorkflow.success) {
              setNodes(convertNodesToReactFlow(updatedWorkflow.nodes));
              setEdges(convertEdgesToReactFlow(updatedWorkflow.edges));
            }
          }
        } else {
          setNodes(convertNodesToReactFlow(workflowResult.nodes));
          setEdges(convertEdgesToReactFlow(workflowResult.edges));
        }
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const convertNodesToReactFlow = (dbNodes: any[]): Node[] => {
    return dbNodes.map((node) => ({
      id: node.id.toString(),
      type: node.type,
      position: { x: node.positionX, y: node.positionY },
      data: {
        config: node.config,
        nodeId: node.id,
        campaignId,
      },
    }));
  };

  const convertEdgesToReactFlow = (dbEdges: any[]): Edge[] => {
    return dbEdges.map((edge) => ({
      id: edge.id.toString(),
      source: edge.sourceNodeId.toString(),
      target: edge.targetNodeId.toString(),
      sourceHandle: edge.sourceHandle || undefined,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      style: edge.sourceHandle === 'yes' 
        ? { stroke: '#22c55e', strokeWidth: 4 }
        : edge.sourceHandle === 'no'
        ? { stroke: '#ef4444', strokeWidth: 4 }
        : { strokeWidth: 4 },
    }));
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      
      const blockType = e.dataTransfer.getData('blockType');
      if (!blockType) return;

      const reactFlowBounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - reactFlowBounds.left;
      const y = e.clientY - reactFlowBounds.top;

      const defaultConfigs: Record<string, any> = {
        email: { subject: 'Nouveau message', body: 'Votre message ici...' },
        call: { notes: 'Points à discuter...' },
        task: { title: 'Nouvelle tâche' },
        transfer: { targetCampaignId: 0, delay: 0 },
        delay: { amount: 2, unit: 'days' },
        waitUntil: { waitUntil: '' },
        timeSlot: { hours: [9, 10, 11, 14, 15, 16], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        condition: { question: 'A répondu au mail ?' },
      };

      const config = defaultConfigs[blockType] || {};

      const result = await createWorkflowNode(campaignId, blockType, config, Math.round(x), Math.round(y));

      if (result.success && result.node) {
        toast.success('Bloc ajouté');
        await loadData();
      } else {
        toast.error(result.error || 'Erreur');
      }
    },
    [campaignId]
  );

  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    const positions = updatedNodes.map((node) => ({
      id: parseInt(node.id),
      x: node.position.x,
      y: node.position.y,
    }));
    
    updateNodePositions(positions);
  }, []);

  const handleEdgesChange = useCallback(
    async (updatedEdges: Edge[]) => {
      const newEdge = updatedEdges[updatedEdges.length - 1];
      if (newEdge && newEdge.source && newEdge.target && newEdge.id.startsWith('temp-')) {
        await createWorkflowEdge(
          campaignId,
          parseInt(newEdge.source),
          parseInt(newEdge.target),
          newEdge.sourceHandle || undefined,
          newEdge.label as string | undefined
        );
        await loadData();
      }
    },
    [campaignId]
  );

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode({
      id: node.data.nodeId,
      type: node.type,
      config: node.data.config,
    });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">Campagne non trouvée</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{campaign.prospectCount || 0} prospects</span>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
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
        <div 
          className="flex-1 relative"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <WorkflowCanvas
            campaignId={campaignId}
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
          />
        </div>

        <AvailableBlocksSidebarNew />
      </div>

      <BlockConfigModal
        block={selectedNode}
        campaignId={campaignId}
        onClose={() => setSelectedNode(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
