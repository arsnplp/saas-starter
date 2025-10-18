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
    const lastUsed = connection[0].connectedAt || new Date(0);
    const daysSinceLastUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

    console.log('🔍 Token check:', {
      hasToken: !!loginToken,
      lastUsed: lastUsed.toISOString(),
      daysSinceLastUse: Math.round(daysSinceLastUse),
    });

    // LinkedIn tokens expirent généralement après 30 jours d'inactivité
    // ou après quelques jours si LinkedIn détecte une activité suspecte
    // On va vérifier avec un vrai appel API simple
    
    try {
      // Test avec un profil LinkedIn public très connu (Bill Gates)
      const testResponse = await fetch('https://api.linkupapi.com/v1/profile/info', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.LINKUP_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_url: 'https://www.linkedin.com/in/williamhgates/',
          login_token: loginToken,
        }),
      });

      const responseText = await testResponse.text();
      console.log('🔍 LinkUp API test response:', {
        status: testResponse.status,
        body: responseText.substring(0, 200),
      });

      if (testResponse.status === 403) {
        const errorData = JSON.parse(responseText);
        if (errorData.message?.toLowerCase().includes('cookie invalid') || 
            errorData.message?.toLowerCase().includes('expired')) {
          console.log('❌ Token LinkedIn EXPIRÉ');
          return NextResponse.json({ valid: false, reason: 'expired' });
        }
      }

      // Si succès ou autre erreur (pas 403 cookie invalid), considérer comme valide
      if (testResponse.ok) {
        console.log('✅ Token LinkedIn VALIDE');
        return NextResponse.json({ valid: true });
      }

      // Pour les autres erreurs, on considère le token comme valide
      // pour éviter les faux positifs (rate limit, crédits épuisés, etc.)
      console.log('⚠️ API error but token probably valid:', testResponse.status);
      return NextResponse.json({ valid: true });
    } catch (testError) {
      console.error('Erreur lors du test du token:', testError);
      // En cas d'erreur réseau, on considère le token comme valide
      return NextResponse.json({ valid: true });
    }
  } catch (error) {
    console.error('Error checking LinkedIn token:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
