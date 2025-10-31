'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  OnConnect,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EmailNode } from './nodes/email-node';
import { CallNode } from './nodes/call-node';
import { TaskNode } from './nodes/task-node';
import { TransferNode } from './nodes/transfer-node';
import { DelayNode } from './nodes/delay-node';
import { WaitUntilNode } from './nodes/waituntil-node';
import { TimeSlotNode } from './nodes/timeslot-node';
import { ConditionNode } from './nodes/condition-node';
import { StartNode } from './nodes/start-node';
import { deleteWorkflowEdge, deleteWorkflowNode } from './workflow-actions';
import { toast } from 'sonner';

const nodeTypes: NodeTypes = {
  start: StartNode,
  email: EmailNode,
  call: CallNode,
  task: TaskNode,
  transfer: TransferNode,
  delay: DelayNode,
  waitUntil: WaitUntilNode,
  timeSlot: TimeSlotNode,
  condition: ConditionNode,
};

type WorkflowCanvasProps = {
  campaignId: number;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeClick?: (node: Node) => void;
  onDelete?: () => void;
};

export function WorkflowCanvas({
  campaignId,
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onDelete,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        let hasChanges = false;
        
        if (selectedNodes.length > 0) {
          const nodesToDelete = selectedNodes.filter(nodeId => nodes.some(n => n.id === nodeId));
          const deletedNodeIds: string[] = [];
          let hasError = false;

          for (const nodeId of nodesToDelete) {
            const nodeIdNum = parseInt(nodeId);
            if (!isNaN(nodeIdNum)) {
              const result = await deleteWorkflowNode(nodeIdNum);
              if (result.success) {
                deletedNodeIds.push(nodeId);
              } else {
                toast.error(result.error || 'Erreur lors de la suppression du bloc');
                hasError = true;
              }
            }
          }
          
          if (deletedNodeIds.length > 0) {
            const updatedNodes = nodes.filter((node) => !deletedNodeIds.includes(node.id));
            setNodes(updatedNodes);
            if (!hasError) {
              toast.success(`${deletedNodeIds.length} bloc(s) supprimé(s)`);
            }
            hasChanges = true;
          }
          
          setSelectedNodes([]);
        }
        
        if (selectedEdges.length > 0) {
          const edgesToDelete = selectedEdges.filter(edgeId => edges.some(e => e.id === edgeId));
          const deletedEdgeIds: string[] = [];
          let hasError = false;

          for (const edgeId of edgesToDelete) {
            if (edgeId.startsWith('temp-')) {
              deletedEdgeIds.push(edgeId);
            } else {
              const edgeIdNum = parseInt(edgeId);
              if (!isNaN(edgeIdNum)) {
                const result = await deleteWorkflowEdge(edgeIdNum);
                if (result.success) {
                  deletedEdgeIds.push(edgeId);
                } else {
                  toast.error(result.error || 'Erreur lors de la suppression de la connexion');
                  hasError = true;
                }
              }
            }
          }
          
          if (deletedEdgeIds.length > 0) {
            const updatedEdges = edges.filter((edge) => !deletedEdgeIds.includes(edge.id));
            setEdges(updatedEdges);
            if (!hasError) {
              toast.success(`${deletedEdgeIds.length} connexion(s) supprimée(s)`);
            }
            hasChanges = true;
          }
          
          setSelectedEdges([]);
        }
        
        if (hasChanges && onDelete) {
          onDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdges, selectedNodes, edges, nodes, setEdges, setNodes, onDelete]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `temp-${Date.now()}`,
        type: 'smoothstep',
        animated: true,
        style:
          connection.sourceHandle === 'yes'
            ? { stroke: '#22c55e', strokeWidth: 4 }
            : connection.sourceHandle === 'no'
            ? { stroke: '#ef4444', strokeWidth: 4 }
            : { strokeWidth: 4 },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      if (onEdgesChange) {
        const updatedEdges = addEdge(newEdge, edges);
        onEdgesChange(updatedEdges);
      }
    },
    [edges, onEdgesChange, setEdges]
  );

  const handleEdgeClick = useCallback((event: any, edge: Edge) => {
    setSelectedEdges([edge.id]);
    setSelectedNodes([]);
  }, []);

  const handleNodeClickInternal = useCallback((event: any, node: Node) => {
    const dbNodeId = node.data?.nodeId || node.id;
    setSelectedNodes([String(dbNodeId)]);
    setSelectedEdges([]);
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleNodeDragStop = useCallback(
    (event: any, node: Node) => {
      if (onNodesChange) {
        const updatedNodes = nodes.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        );
        onNodesChange(updatedNodes);
      }
    },
    [nodes, onNodesChange]
  );

  return (
    <div className="w-full h-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClickInternal}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        connectionLineType="smoothstep"
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 4 }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
