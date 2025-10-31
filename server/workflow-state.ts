import { db } from '@/lib/db';
import { workflowProspectState, workflowNodes, workflowEdges, campaignProspects, WorkflowEdge } from '@/lib/db/schema';
import { eq, and, lte, isNull, or } from 'drizzle-orm';
import { calculateNextScheduledTime, isTimingNode } from './workflow-timing';

/**
 * Initialize workflow state for a prospect when they enter a campaign
 */
export async function initializeProspectWorkflow(
  campaignProspectId: number,
  startNodeId: number
) {
  const existing = await db
    .select()
    .from(workflowProspectState)
    .where(eq(workflowProspectState.campaignProspectId, campaignProspectId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [state] = await db
    .insert(workflowProspectState)
    .values({
      campaignProspectId,
      currentNodeId: startNodeId,
      status: 'ready',
      scheduledFor: new Date(),
    })
    .returning();

  return state;
}

/**
 * Move a prospect to the next node in the workflow
 */
export async function moveProspectToNextNode(
  stateId: number,
  nextNodeId: number | null,
  sourceHandle?: string
) {
  if (nextNodeId === null) {
    await db
      .update(workflowProspectState)
      .set({
        status: 'completed',
        completedAt: new Date(),
        currentNodeId: null,
        updatedAt: new Date(),
      })
      .where(eq(workflowProspectState.id, stateId));
    return;
  }

  const [nextNode] = await db
    .select()
    .from(workflowNodes)
    .where(eq(workflowNodes.id, nextNodeId))
    .limit(1);

  if (!nextNode) {
    throw new Error(`Node ${nextNodeId} not found`);
  }

  let scheduledFor = new Date();
  let status: 'ready' | 'waiting' | 'executing' = 'ready';

  if (isTimingNode(nextNode.type)) {
    scheduledFor = calculateNextScheduledTime(nextNode);
    status = 'waiting';
  }

  await db
    .update(workflowProspectState)
    .set({
      currentNodeId: nextNodeId,
      status,
      scheduledFor,
      lastExecutedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowProspectState.id, stateId));
}

/**
 * Get all prospects that are ready to execute (scheduledFor has passed)
 */
export async function getProspectsReadyToExecute() {
  const now = new Date();
  
  const ready = await db
    .select({
      state: workflowProspectState,
      node: workflowNodes,
      campaignProspect: campaignProspects,
    })
    .from(workflowProspectState)
    .innerJoin(
      workflowNodes,
      eq(workflowProspectState.currentNodeId, workflowNodes.id)
    )
    .innerJoin(
      campaignProspects,
      eq(workflowProspectState.campaignProspectId, campaignProspects.id)
    )
    .where(
      and(
        eq(workflowProspectState.status, 'waiting'),
        lte(workflowProspectState.scheduledFor, now)
      )
    );

  return ready;
}

/**
 * Mark a prospect state as executing
 */
export async function markProspectExecuting(stateId: number) {
  await db
    .update(workflowProspectState)
    .set({
      status: 'executing',
      updatedAt: new Date(),
    })
    .where(eq(workflowProspectState.id, stateId));
}

/**
 * Get the next node(s) from current node
 */
export async function getNextNodes(
  currentNodeId: number,
  sourceHandle?: string
): Promise<number[]> {
  const edges = await db
    .select()
    .from(workflowEdges)
    .where(
      and(
        eq(workflowEdges.sourceNodeId, currentNodeId),
        sourceHandle
          ? eq(workflowEdges.sourceHandle, sourceHandle)
          : or(isNull(workflowEdges.sourceHandle), eq(workflowEdges.sourceHandle, ''))
      )
    );

  return edges.map((e: WorkflowEdge) => e.targetNodeId);
}

/**
 * Get prospect state by campaign prospect ID
 */
export async function getProspectState(campaignProspectId: number) {
  const [state] = await db
    .select()
    .from(workflowProspectState)
    .where(eq(workflowProspectState.campaignProspectId, campaignProspectId))
    .limit(1);

  return state || null;
}

/**
 * Record an error for a prospect's execution
 */
export async function recordProspectError(stateId: number, error: string) {
  await db
    .update(workflowProspectState)
    .set({
      status: 'ready',
      error,
      updatedAt: new Date(),
    })
    .where(eq(workflowProspectState.id, stateId));
}
