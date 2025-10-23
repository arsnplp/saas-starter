import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { getGmailClient } from '@/lib/integrations/gmail';

export async function GET() {
  try {
    const team = await getTeamForUser();
    
    if (!team) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const gmailClient = await getGmailClient(team.id);
    const { messages } = await gmailClient.listMessages(20);

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch emails',
      messages: [] 
    }, { status: 500 });
  }
}
