import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, prospectCandidates, prospectFolders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashApiKey, validateApiKeyFormat } from '@/lib/api-keys';
import { z } from 'zod';

const prospectSchema = z.object({
  name: z.string().min(1),
  profileUrl: z.string().url(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  profilePictureUrl: z.string().url().optional(),
});

const importRequestSchema = z.object({
  prospects: z.array(prospectSchema).min(1).max(100),
  folderId: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
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

    const body = await request.json();
    const validation = importRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { prospects, folderId } = validation.data;
    const teamId = apiKeyRecord.teamId;

    let targetFolderId = folderId;

    if (!targetFolderId) {
      const defaultFolder = await db.query.prospectFolders.findFirst({
        where: and(
          eq(prospectFolders.teamId, teamId),
          eq(prospectFolders.isDefault, true)
        ),
      });

      if (!defaultFolder) {
        const [newFolder] = await db
          .insert(prospectFolders)
          .values({
            teamId,
            name: 'Général',
            color: '#3b82f6',
            icon: 'inbox',
            isDefault: true,
          })
          .returning();
        targetFolderId = newFolder.id;
      } else {
        targetFolderId = defaultFolder.id;
      }
    } else {
      const folderResult = await db
        .select()
        .from(prospectFolders)
        .where(and(
          eq(prospectFolders.id, folderId),
          eq(prospectFolders.teamId, teamId)
        ))
        .limit(1);

      if (folderResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Folder not found or access denied' },
          { status: 404 }
        );
      }
    }

    let imported = 0;
    let duplicates = 0;

    for (const prospect of prospects) {
      const existingResult = await db
        .select()
        .from(prospectCandidates)
        .where(and(
          eq(prospectCandidates.profileUrl, prospect.profileUrl),
          eq(prospectCandidates.teamId, teamId)
        ))
        .limit(1);

      if (existingResult.length > 0) {
        duplicates++;
        continue;
      }

      await db.insert(prospectCandidates).values({
        teamId,
        folderId: targetFolderId,
        source: 'chrome_extension',
        sourceRef: prospect.profileUrl,
        action: 'imported',
        name: prospect.name,
        title: prospect.title || null,
        company: prospect.company || null,
        location: prospect.location || null,
        profileUrl: prospect.profileUrl,
        profilePictureUrl: prospect.profilePictureUrl || null,
        status: 'new',
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      duplicates,
      total: prospects.length,
      folderId: targetFolderId,
    });
  } catch (error) {
    console.error('Error importing prospects:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
