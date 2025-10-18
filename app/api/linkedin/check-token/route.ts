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

    const responseText = await testResponse.text();
    console.log('🔍 Token validation test:', {
      status: testResponse.status,
      response: responseText,
    });

    if (testResponse.status === 403) {
      // Vérifier si c'est vraiment un token expiré
      const errorData = JSON.parse(responseText);
      if (errorData.message?.includes('cookie invalid') || errorData.message?.includes('expired')) {
        console.log('❌ Token LinkedIn expiré');
        return NextResponse.json({ valid: false, reason: 'expired' });
      }
      // Autre erreur 403 (crédits, etc.)
      console.log('⚠️ Erreur 403 mais pas token expiré:', errorData.message);
      return NextResponse.json({ valid: true }); // Considérer comme valide
    }

    if (!testResponse.ok) {
      // Autre erreur API (400, 500, etc.)
      console.log('⚠️ Erreur API LinkUp:', testResponse.status);
      return NextResponse.json({ valid: true }); // Considérer comme valide pour éviter les faux positifs
    }

    // Token valide ✅
    console.log('✅ Token LinkedIn valide');
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error checking LinkedIn token:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
