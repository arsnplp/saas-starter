import { getProspectsReadyToExecute, markProspectExecuting, moveProspectToNextNode, getNextNodes, recordProspectError } from '../workflow-state';
import { db } from '@/lib/db';
import { prospectCandidates, campaigns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmailWithVariables, extractProspectVariables } from '../email-sender';

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

      // Get campaign info for teamId
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignProspect.campaignId))
        .limit(1);

      if (!campaign) {
        throw new Error(`Campaign ${campaignProspect.campaignId} not found`);
      }

      const result = await executeNode(node, prospectData, campaign.teamId);

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
 */
async function executeNode(
  node: any,
  prospect: any,
  teamId: number
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
      return await executeEmailNode(node, prospect, teamId);

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

/**
 * Execute an email node - send email with variable substitution
 */
async function executeEmailNode(
  node: any,
  prospect: any,
  teamId: number
): Promise<{ success: boolean; nextHandle?: string }> {
  const config = node.config || {};
  const subject = config.subject || '';
  const body = config.body || '';

  // Check if prospect has an email
  if (!prospect.email) {
    console.warn(`[WorkflowProcessor] Prospect ${prospect.id} has no email, skipping email node`);
    throw new Error(`Prospect has no email address`);
  }

  // Extract variables from prospect
  const variables = extractProspectVariables(prospect);

  console.log(`[WorkflowProcessor] Sending email to ${prospect.email} (${prospect.name})`);
  console.log(`[WorkflowProcessor] Subject: ${subject}`);

  // Send email with variable substitution
  const result = await sendEmailWithVariables(
    teamId,
    prospect.email,
    subject,
    body,
    variables
  );

  if (!result.success) {
    console.error(`[WorkflowProcessor] Failed to send email: ${result.error}`);
    throw new Error(result.error || 'Failed to send email');
  }

  console.log(`[WorkflowProcessor] Successfully sent email to ${prospect.email}`);
  return { success: true };
}
