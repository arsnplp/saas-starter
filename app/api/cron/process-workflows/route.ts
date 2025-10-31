import { NextRequest, NextResponse } from 'next/server';
import { processReadyProspects } from '@/server/cron/workflow-processor';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== process.env.INGEST_API_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const processedCount = await processReadyProspects();

    return NextResponse.json({
      success: true,
      processedCount,
      message: `Processed ${processedCount} prospects`,
    });
  } catch (error: any) {
    console.error('[ProcessWorkflows] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process workflows' },
      { status: 500 }
    );
  }
}
