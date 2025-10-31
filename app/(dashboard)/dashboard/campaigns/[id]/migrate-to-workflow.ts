'use server';

import { db } from '@/lib/db';
import { campaignBlocks, workflowNodes, workflowEdges, campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

export async function migrateBlocksToWorkflow(campaignId: number) {
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

  const existingNodes = await db.query.workflowNodes.findMany({
    where: eq(workflowNodes.campaignId, campaignId),
  });

  if (existingNodes.length > 0) {
    return { success: true, message: 'Workflow déjà migré' };
  }

  const blocks = await db.query.campaignBlocks.findMany({
    where: eq(campaignBlocks.campaignId, campaignId),
    orderBy: (blocks, { asc }) => [asc(blocks.order)],
  });

  if (blocks.length === 0) {
    const [startNode] = await db
      .insert(workflowNodes)
      .values({
        campaignId,
        type: 'start',
        config: {},
        positionX: 250,
        positionY: 50,
      })
      .returning();

    return { success: true, message: 'Nœud de départ créé', startNodeId: startNode.id };
  }

  const [startNode] = await db
    .insert(workflowNodes)
    .values({
      campaignId,
      type: 'start',
      config: {},
      positionX: 250,
      positionY: 50,
    })
    .returning();

  let previousNodeId = startNode.id;
  let currentY = 150;

  for (const block of blocks) {
    const [node] = await db
      .insert(workflowNodes)
      .values({
        campaignId,
        type: block.type,
        config: block.config,
        positionX: 250,
        positionY: currentY,
      })
      .returning();

    await db
      .insert(workflowEdges)
      .values({
        campaignId,
        sourceNodeId: previousNodeId,
        targetNodeId: node.id,
      });

    previousNodeId = node.id;
    currentY += 120;
  }

  return { success: true, message: 'Migration réussie', nodeCount: blocks.length + 1 };
}
