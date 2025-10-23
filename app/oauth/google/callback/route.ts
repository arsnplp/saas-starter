import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { gmailConnections, oauthStates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';

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
      return NextResponse.redirect(
        new URL('/sign-in?error=session_expired', request.url)
      );
    }

    const team = await getTeamForUser();
    if (!team) {
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
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=invalid_state', request.url)
      );
    }

    if (new Date() > oauthState.expiresAt) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=state_expired', request.url)
      );
    }

    if (oauthState.userId !== user.id || oauthState.teamId !== team.id) {
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
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=callback_failed', request.url)
    );
  }
}
