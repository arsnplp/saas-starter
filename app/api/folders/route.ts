import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, prospectFolders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashApiKey, validateApiKeyFormat } from '@/lib/api-keys';

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    if (!validateApiKeyFormat(apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
        { status: 401 }
      );
    }

    const keyHash = hashApiKey(apiKey);

    const apiKeyRecord = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ),
    });

    if (!apiKeyRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id));

    const teamId = apiKeyRecord.teamId;

    const folders = await db
      .select({
        id: prospectFolders.id,
        name: prospectFolders.name,
      })
      .from(prospectFolders)
      .where(eq(prospectFolders.teamId, teamId))
      .orderBy(prospectFolders.id);

    return NextResponse.json({
      success: true,
      folders,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}
