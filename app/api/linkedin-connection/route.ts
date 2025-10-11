import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, team.id),
      with: {
        connectedByUser: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        isConnected: false,
        linkedinEmail: null,
        connectedAt: null,
        lastUsedAt: null,
        connectedBy: null,
      });
    }

    return NextResponse.json({
      isConnected: connection.isActive,
      linkedinEmail: connection.linkedinEmail || null,
      connectedAt: connection.connectedAt?.toISOString() || null,
      lastUsedAt: connection.lastUsedAt?.toISOString() || null,
      connectedBy: connection.connectedByUser?.name || connection.connectedByUser?.email || null,
    });
  } catch (error) {
    console.error('LinkedIn connection check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
