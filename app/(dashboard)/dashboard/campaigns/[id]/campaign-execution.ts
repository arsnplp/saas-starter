'use server';

import { db } from '@/lib/db';
import { 
  workflowNodes, 
  workflowEdges, 
  campaigns,
  campaignProspects,
  prospectCandidates
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

type WorkflowNode = {
  id: number;
  type: string;
  config: any;
};

type WorkflowEdge = {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  sourceHandle: string | null;
};

export async function startCampaignExecution(campaignId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.teamId, team.id)
    ),
  });

  if (!campaign) {
    return { success: false, error: 'Campagne non trouvée' };
  }

  const nodes = await db.query.workflowNodes.findMany({
    where: eq(workflowNodes.campaignId, campaignId),
  });

  const edges = await db.query.workflowEdges.findMany({
    where: eq(workflowEdges.campaignId, campaignId),
  });

  const startNode = nodes.find((node) => node.type === 'start');
  if (!startNode) {
    return { success: false, error: 'Pas de bloc de démarrage trouvé' };
  }

  const prospects = await db.query.campaignProspects.findMany({
    where: eq(campaignProspects.campaignId, campaignId),
    with: {
      prospect: true,
    },
  });

  if (prospects.length === 0) {
    return { success: false, error: 'Aucun prospect assigné à cette campagne' };
  }

  const executionPlan = buildExecutionPlan(startNode, nodes, edges);

  return {
    success: true,
    message: `Campagne démarrée pour ${prospects.length} prospect(s)`,
    executionPlan,
    prospectCount: prospects.length,
  };
}

function buildExecutionPlan(
  startNode: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): any[] {
  const plan: any[] = [];
  const visited = new Set<number>();
  const queue: { nodeId: number; path: string }[] = [
    { nodeId: startNode.id, path: 'main' },
  ];

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    plan.push({
      step: plan.length + 1,
      type: node.type,
      config: node.config,
      path,
    });

    const outgoingEdges = edges.filter((e) => e.sourceNodeId === nodeId);

    for (const edge of outgoingEdges) {
      let newPath = path;
      if (edge.sourceHandle === 'yes') {
        newPath = `${path}/yes`;
      } else if (edge.sourceHandle === 'no') {
        newPath = `${path}/no`;
      }

      queue.push({
        nodeId: edge.targetNodeId,
        path: newPath,
      });
    }
  }

  return plan;
}

export async function executeWorkflowForProspect(
  campaignId: number,
  prospectId: number
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const nodes = await db.query.workflowNodes.findMany({
    where: eq(workflowNodes.campaignId, campaignId),
  });

  const edges = await db.query.workflowEdges.findMany({
    where: eq(workflowEdges.campaignId, campaignId),
  });

  const startNode = nodes.find((node) => node.type === 'start');
  if (!startNode) {
    return { success: false, error: 'Pas de bloc de démarrage' };
  }

  const executionLog = await executeNode(
    startNode,
    nodes,
    edges,
    prospectId,
    campaignId
  );

  return {
    success: true,
    executionLog,
  };
}

async function executeNode(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
  prospectId: number,
  campaignId: number,
  visited: Set<number> = new Set()
): Promise<any[]> {
  const log: any[] = [];

  if (visited.has(node.id)) {
    return log;
  }
  visited.add(node.id);

  log.push({
    timestamp: new Date(),
    nodeType: node.type,
    config: node.config,
    status: 'executed',
  });

  const outgoingEdges = allEdges.filter((e) => e.sourceNodeId === node.id);

  if (node.type === 'condition') {
    const yesEdge = outgoingEdges.find((e) => e.sourceHandle === 'yes');
    const noEdge = outgoingEdges.find((e) => e.sourceHandle === 'no');

    const conditionResult = await evaluateCondition(node.config, prospectId);

    const nextEdge = conditionResult ? yesEdge : noEdge;
    if (nextEdge) {
      const nextNode = allNodes.find((n) => n.id === nextEdge.targetNodeId);
      if (nextNode) {
        const nextLog = await executeNode(
          nextNode,
          allNodes,
          allEdges,
          prospectId,
          campaignId,
          visited
        );
        log.push(...nextLog);
      }
    }
  } else {
    for (const edge of outgoingEdges) {
      const nextNode = allNodes.find((n) => n.id === edge.targetNodeId);
      if (nextNode) {
        const nextLog = await executeNode(
          nextNode,
          allNodes,
          allEdges,
          prospectId,
          campaignId,
          visited
        );
        log.push(...nextLog);
      }
    }
  }

  return log;
}

async function evaluateCondition(config: any, prospectId: number): Promise<boolean> {
  return Math.random() > 0.5;
}
