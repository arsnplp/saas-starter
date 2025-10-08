import { NextRequest, NextResponse } from 'next/server';
import { requireIngestAuth } from '@/lib/auth/ingest-auth';
import { linkupIngest } from '@/lib/integrations/linkup-ingest';
import { z } from 'zod';

const ingestLeadsSchema = z.object({
  postUrl: z.string().url().optional(),
  keywords: z.string().optional(),
  industry: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
});

export async function POST(req: NextRequest) {
  const authError = requireIngestAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const body = await req.json();
    const validated = ingestLeadsSchema.parse(body);

    const result = await linkupIngest({
      path: '/leads/search',
      body: validated,
    });

    console.info('ℹ️ [INGEST] Leads ingestion completed', {
      source: validated.postUrl || 'search',
      count: result.items?.length || 0,
      mock: result.mock,
    });

    return NextResponse.json({
      success: true,
      leads: result.items || [],
      count: result.items?.length || 0,
      mock: result.mock,
    });
  } catch (error: any) {
    console.error('❌ [INGEST] Leads ingestion failed:', error.message);

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
