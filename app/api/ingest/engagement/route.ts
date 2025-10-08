import { NextRequest, NextResponse } from 'next/server';
import { requireIngestAuth } from '@/lib/auth/ingest-auth';
import { linkupIngest } from '@/lib/integrations/linkup-ingest';
import { z } from 'zod';

const ingestEngagementSchema = z.object({
  postUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  const authError = requireIngestAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const body = await req.json();
    const { postUrl } = ingestEngagementSchema.parse(body);

    const result = await linkupIngest({
      path: '/engagement/post',
      body: { postUrl },
    });

    console.info('ℹ️ [INGEST] Engagement ingestion completed', {
      source: postUrl,
      count: result.items?.length || 0,
      mock: result.mock,
    });

    return NextResponse.json({
      success: true,
      engagement: result.data || {},
      items: result.items || [],
      count: result.items?.length || 0,
      mock: result.mock,
    });
  } catch (error: any) {
    console.error('❌ [INGEST] Engagement ingestion failed:', error.message);

    if (error.message?.includes('Missing LINKUP_API_KEY')) {
      return NextResponse.json(
        {
          error: 'configuration_error',
          message: 'Missing LINKUP_API_KEY - API key is required when mock mode is disabled',
          mock: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'ingestion_failed',
        message: error.message || 'Unknown error',
        mock: false,
      },
      { status: error.status || 500 }
    );
  }
}
