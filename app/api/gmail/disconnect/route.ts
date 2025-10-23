import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { gmailConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    const team = await getTeamForUser();
    
    if (!team) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await db
      .update(gmailConnections)
      .set({ isActive: false })
      .where(eq(gmailConnections.teamId, team.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
