import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { gmailConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GmailClient } from '@/lib/integrations/gmail';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    const connection = await db.query.gmailConnections.findFirst({
      where: eq(gmailConnections.teamId, team.id),
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 });
    }

    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const gmailClient = new GmailClient(
      connection.accessToken,
      connection.refreshToken || null,
      connection.expiresAt,
      team.id
    );

    await gmailClient.sendEmail(to, subject, body);

    return NextResponse.json({
      success: true,
      message: 'Email envoyé avec succès',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
