import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, ActivityType, activityLogs } from '@/lib/db/schema';
import { comparePasswords, signToken } from '@/lib/auth/session';

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = signInSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const userWithTeam = await db
      .select({
        user: users,
        team: teams,
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(users.email, email))
      .limit(1);

    if (userWithTeam.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const { user: foundUser, team: foundTeam } = userWithTeam[0];

    const isPasswordValid = await comparePasswords(password, foundUser.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log('🔑 [API-SIGN-IN] User found:', { id: foundUser.id, email: foundUser.email });

    const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = {
      user: { id: foundUser.id },
      expires: expiresInOneDay.toISOString(),
    };
    const encryptedSession = await signToken(session);

    console.log('🍪 [API-SIGN-IN] Creating session cookie');

    if (foundTeam?.id) {
      await db.insert(activityLogs).values({
        teamId: foundTeam.id,
        userId: foundUser.id,
        action: ActivityType.SIGN_IN,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: 'session',
      value: encryptedSession,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      domain: '.spock.replit.dev',
      expires: expiresInOneDay,
    });

    console.log('✅ [API-SIGN-IN] Session cookie set in response headers');

    return response;
  } catch (error) {
    console.error('❌ [API-SIGN-IN] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
