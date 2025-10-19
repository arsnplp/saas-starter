import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ 
        success: false,
        message: '❌ Non autorisé - veuillez vous connecter',
      }, { status: 401 });
    }

    const team = await getTeamForUser();

    if (!team) {
      return NextResponse.json({ 
        success: false,
        message: '❌ Équipe non trouvée',
      }, { status: 404 });
    }

    const connection = await db.query.linkedinConnections.findFirst({
      where: eq(linkedinConnections.teamId, team.id),
    });

    if (!connection || !connection.loginToken) {
      return NextResponse.json({
        success: false,
        message: '❌ Aucune connexion LinkedIn trouvée. Connectez-vous d\'abord dans l\'onglet Intégrations.',
        details: {
          linkedinEmail: null,
          connectedAt: null,
        },
      });
    }

    const apiKey = process.env.LINKUP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: '❌ Configuration manquante - LINKUP_API_KEY non définie',
        details: {
          linkedinEmail: connection.linkedinEmail,
        },
      });
    }

    // Test simple avec un profil LinkedIn public
    const testProfileUrl = 'https://www.linkedin.com/in/williamhgates';
    
    console.log('🧪 Test de connexion LinkUp - Email:', connection.linkedinEmail);
    const response = await fetch('https://api.linkupapi.com/v1/profile/info', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedin_url: testProfileUrl,
        login_token: connection.loginToken,
      }),
    });

    const responseText = await response.text();
    console.log(`📡 Réponse test status: ${response.status} ${response.ok ? '✅' : '❌'}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      // Extract useful diagnostic info from the response
      const diagnostics = {
        apiStatus: 'operational',
        httpStatus: response.status,
        profileFetched: responseData.data?.name || 'Test réussi',
        linkedinEmail: connection.linkedinEmail,
        connectedAt: connection.connectedAt?.toISOString(),
        lastUsedAt: connection.lastUsedAt?.toISOString(),
        // Credits info if available from response headers
        creditsRemaining: response.headers.get('x-credits-remaining') || 'Non disponible',
        rateLimit: response.headers.get('x-ratelimit-remaining') || 'Non disponible',
      };

      return NextResponse.json({
        success: true,
        message: '✅ Connexion LinkUp opérationnelle !',
        details: diagnostics,
      });
    } else {
      // Parse error details without exposing tokens
      const errorDetails = {
        apiStatus: 'error',
        httpStatus: response.status,
        httpStatusText: response.statusText,
        errorMessage: responseData.message || responseData.error || 'Erreur inconnue',
        linkedinEmail: connection.linkedinEmail,
        connectedAt: connection.connectedAt?.toISOString(),
        lastUsedAt: connection.lastUsedAt?.toISOString(),
        possibleCauses: response.status === 403 
          ? ['Session LinkedIn expirée', 'Crédits LinkUp épuisés', 'Token invalide']
          : ['Erreur réseau', 'API temporairement indisponible'],
      };

      return NextResponse.json({
        success: false,
        message: `❌ Test échoué: ${errorDetails.errorMessage}`,
        details: errorDetails,
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: `❌ Erreur interne: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        details: {
          errorType: 'internal_error',
        },
      },
      { status: 500 }
    );
  }
}
