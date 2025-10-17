import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { LinkedInOAuthService } from '@/lib/services/linkedin-oauth';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await LinkedInOAuthService.disconnect(team.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LinkedIn OAuth disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
