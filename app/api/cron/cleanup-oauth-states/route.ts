import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { oauthStates } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.INGEST_API_TOKEN}`;
    
    if (authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    
    const result = await db
      .delete(oauthStates)
      .where(lt(oauthStates.expiresAt, now))
      .returning();

    return NextResponse.json({
      success: true,
      deletedCount: result.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up OAuth states:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
