import { NextRequest, NextResponse } from 'next/server';

export function requireIngestAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.INGEST_API_TOKEN;

  if (!expectedToken) {
    console.error('❌ [INGEST_AUTH] INGEST_API_TOKEN is not configured');
    return NextResponse.json(
      { error: 'unauthorized', message: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('⚠️ [INGEST_AUTH] Unauthorized ingestion attempt - missing or invalid Authorization header');
    return NextResponse.json(
      { error: 'unauthorized', message: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  if (token !== expectedToken) {
    console.warn('⚠️ [INGEST_AUTH] Unauthorized ingestion attempt - invalid token');
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid token' },
      { status: 401 }
    );
  }

  return null;
}
