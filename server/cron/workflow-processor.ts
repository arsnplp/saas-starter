import { getProspectsReadyToExecute, markProspectExecuting, moveProspectToNextNode, getNextNodes, recordProspectError } from '../workflow-state';
import { db } from '@/lib/db';
import { prospectCandidates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Process all prospects that are ready to execute
 * This should be called by a cron job every minute or so
 */
export async function processReadyProspects() {
  const ready = await getProspectsReadyToExecute();

  console.log(`[WorkflowProcessor] Found ${ready.length} prospects ready to execute`);

  for (const { state, node, campaignProspect } of ready) {
    try {
      console.log(`[WorkflowProcessor] Processing prospect ${campaignProspect.prospectId} at node ${node.id} (${node.type})`);

      await markProspectExecuting(state.id);

      const [prospectData] = await db
        .select()
        .from(prospectCandidates)
        .where(eq(prospectCandidates.id, campaignProspect.prospectId))
        .limit(1);

      if (!prospectData) {
        throw new Error(`Prospect ${campaignProspect.prospectId} not found`);
      }

      const result = await executeNode(node, prospectData);

      const nextNodeIds = await getNextNodes(node.id, result.nextHandle);

      if (nextNodeIds.length === 0) {
        await moveProspectToNextNode(state.id, null);
        console.log(`[WorkflowProcessor] Prospect ${campaignProspect.prospectId} completed workflow`);
      } else {
        await moveProspectToNextNode(state.id, nextNodeIds[0], result.nextHandle);
        console.log(`[WorkflowProcessor] Moved prospect ${campaignProspect.prospectId} to node ${nextNodeIds[0]}`);
      }
    } catch (error: any) {
      console.error(`[WorkflowProcessor] Error processing prospect:`, error);
      await recordProspectError(state.id, error.message || 'Unknown error');
    }
  }

  return ready.length;
}

/**
 * Execute a single node for a prospect
 * This is a placeholder - actual implementation will be added later
 */
async function executeNode(
  node: any,
  prospect: any
): Promise<{ success: boolean; nextHandle?: string }> {
  console.log(`[WorkflowProcessor] Executing ${node.type} node for prospect ${prospect.id}`);

  switch (node.type) {
    case 'start':
      return { success: true };

    case 'delay':
    case 'waitUntil':
    case 'timeSlot':
      return { success: true };

    case 'email':
      console.log(`[WorkflowProcessor] Would send email to ${prospect.email}`);
      return { success: true };

    case 'call':
      console.log(`[WorkflowProcessor] Would create call task for ${prospect.name}`);
      return { success: true };

    case 'task':
      console.log(`[WorkflowProcessor] Would create task for ${prospect.name}`);
      return { success: true };

    case 'condition':
      const randomChoice = Math.random() > 0.5;
      console.log(`[WorkflowProcessor] Condition evaluation: ${randomChoice ? 'yes' : 'no'}`);
      return { success: true, nextHandle: randomChoice ? 'yes' : 'no' };

    case 'visitLinkedIn':
      console.log(`[WorkflowProcessor] Would visit LinkedIn profile of ${prospect.name}`);
      return { success: true };

    case 'addConnection':
      console.log(`[WorkflowProcessor] Would send LinkedIn connection to ${prospect.name}`);
      return { success: true };

    case 'linkedInMessage':
      console.log(`[WorkflowProcessor] Would send LinkedIn message to ${prospect.name}`);
      return { success: true };

    case 'transfer':
      console.log(`[WorkflowProcessor] Would transfer ${prospect.name} to another campaign`);
      return { success: true };

    default:
      console.log(`[WorkflowProcessor] Unknown node type: ${node.type}`);
      return { success: true };
  }
}
