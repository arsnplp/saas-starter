import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaignExecutions, campaignBlocks, campaignProspects, prospectCandidates } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { emailService } from '@/lib/campaigns/email-service';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token !== process.env.INGEST_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pendingExecutions = await db.query.campaignExecutions.findMany({
      where: and(
        eq(campaignExecutions.status, 'pending'),
        lte(campaignExecutions.scheduledAt, new Date())
      ),
      with: {
        block: true,
        campaignProspect: {
          with: {
            prospect: true,
            campaign: true,
          },
        },
      },
      limit: 50,
    });

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const execution of pendingExecutions) {
      try {
        if (execution.block.type === 'email') {
          const config = execution.block.config as { subject: string; body: string };
          
          const result = await emailService.sendCampaignEmail(
            execution.campaignProspect.campaign.teamId,
            execution.campaignProspect.prospectId,
            config
          );

          if (result.success) {
            await db
              .update(campaignExecutions)
              .set({
                status: 'done',
                executedAt: new Date(),
                result: { sentAt: new Date().toISOString() },
              })
              .where(eq(campaignExecutions.id, execution.id));
            processed++;
          } else {
            await db
              .update(campaignExecutions)
              .set({
                status: 'failed',
                executedAt: new Date(),
                error: result.error || 'Unknown error',
              })
              .where(eq(campaignExecutions.id, execution.id));
            failed++;
            errors.push(`Execution ${execution.id}: ${result.error}`);
          }
        }
      } catch (error) {
        console.error('Error executing campaign block:', error);
        await db
          .update(campaignExecutions)
          .set({
            status: 'failed',
            executedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(campaignExecutions.id, execution.id));
        failed++;
        errors.push(`Execution ${execution.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: pendingExecutions.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in execute-campaigns cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
