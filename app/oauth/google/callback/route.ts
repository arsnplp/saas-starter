import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { gmailConnections, oauthStates, oauthFailureLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

async function logOAuthFailure(
  provider: string,
  failureType: string,
  request: NextRequest,
  options?: {
    state?: string;
    userId?: number;
    teamId?: number;
    errorMessage?: string;
  }
) {
  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await db.insert(oauthFailureLogs).values({
      provider,
      failureType,
      state: options?.state,
      userId: options?.userId,
      teamId: options?.teamId,
      errorMessage: options?.errorMessage,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Failed to log OAuth failure:', error);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=missing_parameters', request.url)
    );
  }

  try {
    const user = await getUser();
    if (!user) {
      await logOAuthFailure('google', 'session_expired', request, { state });
      return NextResponse.redirect(
        new URL('/sign-in?error=session_expired', request.url)
      );
    }

    const team = await getTeamForUser();
    if (!team) {
      await logOAuthFailure('google', 'no_team', request, { 
        state, 
        userId: user.id 
      });
      return NextResponse.redirect(
        new URL('/sign-in?error=no_team', request.url)
      );
    }

    const oauthState = await db.query.oauthStates.findFirst({
      where: and(
        eq(oauthStates.state, state),
        eq(oauthStates.provider, 'google'),
        eq(oauthStates.used, false)
      ),
    });

    if (!oauthState) {
      await logOAuthFailure('google', 'invalid_state', request, { 
        state,
        userId: user.id,
        teamId: team.id,
        errorMessage: 'State not found or already used'
      });
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=invalid_state', request.url)
      );
    }

    if (new Date() > oauthState.expiresAt) {
      await logOAuthFailure('google', 'state_expired', request, { 
        state,
        userId: user.id,
        teamId: team.id,
        errorMessage: `State expired at ${oauthState.expiresAt.toISOString()}`
      });
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=state_expired', request.url)
      );
    }

    if (oauthState.userId !== user.id || oauthState.teamId !== team.id) {
      await logOAuthFailure('google', 'user_mismatch', request, { 
        state,
        userId: user.id,
        teamId: team.id,
        errorMessage: `Expected user ${oauthState.userId}/team ${oauthState.teamId}, got user ${user.id}/team ${team.id}`
      });
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=user_mismatch', request.url)
      );
    }

    await db
      .update(oauthStates)
      .set({ used: true })
      .where(eq(oauthStates.state, state));

    const teamId = team.id;
    const userId = user.id;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Google token error:', errorData);
      await logOAuthFailure('google', 'token_exchange_failed', request, {
        state,
        userId,
        teamId,
        errorMessage: JSON.stringify(errorData)
      });
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();
    const googleEmail = userInfo.email;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existingConnection = await db.query.gmailConnections.findFirst({
      where: eq(gmailConnections.teamId, teamId),
    });

    if (existingConnection) {
      await db
        .update(gmailConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existingConnection.refreshToken,
          expiresAt,
          scope: tokens.scope,
          googleEmail,
          lastRefreshedAt: new Date(),
          isActive: true,
        })
        .where(eq(gmailConnections.teamId, teamId));
    } else {
      await db.insert(gmailConnections).values({
        teamId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope,
        googleEmail,
        connectedBy: userId,
        isActive: true,
      });
    }

    return NextResponse.redirect(
      new URL('/dashboard/integrations?success=gmail_connected', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    await logOAuthFailure('google', 'callback_exception', request, {
      state,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=callback_failed', request.url)
    );
  }
}
