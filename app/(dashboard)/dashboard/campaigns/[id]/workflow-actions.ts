'use server';

import { db } from '@/lib/db';
import { workflowNodes, workflowEdges, campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { revalidatePath } from 'next/cache';

export async function createWorkflowNode(
  campaignId: number,
  type: string,
  config: any,
  positionX: number,
  positionY: number
) {
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

  const [node] = await db
    .insert(workflowNodes)
    .values({
      campaignId,
      type,
      config,
      positionX,
      positionY,
    })
    .returning();

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true, node };
}

export async function updateWorkflowNode(
  nodeId: number,
  config: any,
  positionX?: number,
  positionY?: number
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const node = await db.query.workflowNodes.findFirst({
    where: eq(workflowNodes.id, nodeId),
    with: {
      campaign: true,
    },
  });

  if (!node || node.campaign.teamId !== team.id) {
    return { success: false, error: 'Nœud non trouvé' };
  }

  const updateData: any = {
    config,
    updatedAt: new Date(),
  };

  if (positionX !== undefined) updateData.positionX = positionX;
  if (positionY !== undefined) updateData.positionY = positionY;

  await db
    .update(workflowNodes)
    .set(updateData)
    .where(eq(workflowNodes.id, nodeId));

  revalidatePath(`/dashboard/campaigns/${node.campaignId}`);

  return { success: true };
}

export async function deleteWorkflowNode(nodeId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const node = await db.query.workflowNodes.findFirst({
    where: eq(workflowNodes.id, nodeId),
    with: {
      campaign: true,
    },
  });

  if (!node || node.campaign.teamId !== team.id) {
    return { success: false, error: 'Nœud non trouvé' };
  }

  await db.delete(workflowNodes).where(eq(workflowNodes.id, nodeId));

  revalidatePath(`/dashboard/campaigns/${node.campaignId}`);

  return { success: true };
}

export async function createWorkflowEdge(
  campaignId: number,
  sourceNodeId: number,
  targetNodeId: number,
  sourceHandle?: string,
  label?: string,
  conditionType?: string,
  conditionValue?: any
) {
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

  const sourceNode = await db.query.workflowNodes.findFirst({
    where: and(
      eq(workflowNodes.id, sourceNodeId),
      eq(workflowNodes.campaignId, campaignId)
    ),
  });

  if (!sourceNode) {
    return { success: false, error: 'Nœud source non trouvé ou n\'appartient pas à cette campagne' };
  }

  const targetNode = await db.query.workflowNodes.findFirst({
    where: and(
      eq(workflowNodes.id, targetNodeId),
      eq(workflowNodes.campaignId, campaignId)
    ),
  });

  if (!targetNode) {
    return { success: false, error: 'Nœud cible non trouvé ou n\'appartient pas à cette campagne' };
  }

  const [edge] = await db
    .insert(workflowEdges)
    .values({
      campaignId,
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      label,
      conditionType,
      conditionValue,
    })
    .returning();

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { success: true, edge };
}

export async function deleteWorkflowEdge(edgeId: number) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  const edge = await db.query.workflowEdges.findFirst({
    where: eq(workflowEdges.id, edgeId),
    with: {
      campaign: true,
    },
  });

  if (!edge || edge.campaign.teamId !== team.id) {
    return { success: false, error: 'Edge non trouvé' };
  }

  await db.delete(workflowEdges).where(eq(workflowEdges.id, edgeId));

  revalidatePath(`/dashboard/campaigns/${edge.campaignId}`);

  return { success: true };
}

export async function getWorkflowData(campaignId: number) {
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

  return { success: true, nodes, edges };
}

export async function updateNodePositions(
  nodePositions: Array<{ id: number; x: number; y: number }>
) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Non authentifié' };
  }

  const team = await getTeamForUser();
  if (!team) {
    return { success: false, error: 'Équipe non trouvée' };
  }

  for (const pos of nodePositions) {
    const node = await db.query.workflowNodes.findFirst({
      where: eq(workflowNodes.id, pos.id),
      with: {
        campaign: true,
      },
    });

    if (!node || node.campaign.teamId !== team.id) {
      continue;
    }

    await db
      .update(workflowNodes)
      .set({ positionX: pos.x, positionY: pos.y })
      .where(eq(workflowNodes.id, pos.id));
  }

  return { success: true };
}
