import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ valid: false, reason: 'not_authenticated' });
    }

    // Vérifier si une connexion LinkUp existe pour cette team
    const connection = await db
      .select()
      .from(linkedinConnections)
      .where(eq(linkedinConnections.teamId, team.id))
      .limit(1);

    if (!connection.length || !connection[0].loginToken) {
      return NextResponse.json({ valid: false, reason: 'no_connection' });
    }

    const loginToken = connection[0].loginToken;

    // Tester le token avec un appel LinkUp simple
    const testResponse = await fetch('https://api.linkupapi.com/v1/profile/info', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.LINKUP_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profile_url: 'https://www.linkedin.com/in/williamhgates', // Profil test public
        login_token: loginToken,
      }),
    });

    if (testResponse.status === 403) {
      // Token expiré
      return NextResponse.json({ valid: false, reason: 'expired' });
    }

    if (!testResponse.ok) {
      // Autre erreur API
      return NextResponse.json({ valid: false, reason: 'api_error' });
    }

    // Token valide ✅
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error checking LinkedIn token:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
