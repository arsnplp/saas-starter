'use client';

import { useCallback, useState } from 'react';
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
};

export function WorkflowCanvas({
  campaignId,
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      if (onEdgesChange) {
        onEdgesChange([...edges, connection as any]);
      }
    },
    [edges, onEdgesChange, setEdges]
  );

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
        onNodeClick={(event, node) => onNodeClick?.(node)}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
