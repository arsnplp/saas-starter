import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getTeamForUser } from '@/lib/db/queries';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '784djxuzx9ondt';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const team = await getTeamForUser();
    
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const redirectUri = `${process.env.REPLIT_DEV_DOMAIN || 'https://dcbf23d9-46ed-499d-9a94-c2fd5826b035-00-2vo8j2e80ihth.spock.replit.dev'}/api/auth/linkedin/callback`;
    
    const state = crypto.randomUUID();
    const scope = 'openid profile email w_member_social';
    
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', LINKEDIN_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', state);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      state,
    });

  } catch (error) {
    console.error('LinkedIn OAuth start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
