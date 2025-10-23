import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { gmailConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const team = await getTeamForUser();
    
    if (!team) {
      return NextResponse.json({ isConnected: false });
    }

    const connection = await db.query.gmailConnections.findFirst({
      where: eq(gmailConnections.teamId, team.id),
      with: {
        connectedByUser: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json({ isConnected: false });
    }

    const now = new Date();
    const expiresAt = new Date(connection.expiresAt);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isExpiringSoon = hoursUntilExpiry < 24 && hoursUntilExpiry > 0;

    return NextResponse.json({
      isConnected: true,
      googleEmail: connection.googleEmail,
      connectedAt: connection.connectedAt.toISOString(),
      connectedBy: connection.connectedByUser?.name || connection.connectedByUser?.email,
      expiresAt: connection.expiresAt.toISOString(),
      lastRefreshedAt: connection.lastRefreshedAt?.toISOString() || null,
      isExpiringSoon,
    });
  } catch (error) {
    console.error('Error checking Gmail connection:', error);
    return NextResponse.json({ isConnected: false });
  }
}
