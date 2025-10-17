import { NextRequest, NextResponse } from "next/server";
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { linkedinOAuthCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '784djxuzx9ondt';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return renderHtml({
      error: true,
      title: "❌ Erreur d'autorisation",
      message: `Erreur: ${error}`,
      details: errorDesc || '',
    });
  }

  if (!code) {
    return renderHtml({
      error: true,
      title: "⚠️ Aucun code reçu",
      message: "Aucun code d'autorisation n'a été trouvé dans la réponse.",
    });
  }

  const savedState = req.cookies.get('linkedin_oauth_state')?.value;
  
  if (!savedState || savedState !== state) {
    return renderHtml({
      error: true,
      title: "🔒 Erreur de sécurité",
      message: "La validation du state a échoué. Veuillez réessayer.",
      details: "Protection CSRF - le state OAuth ne correspond pas.",
    });
  }

  try {
    const user = await getUser();
    
    if (!user) {
      return renderHtml({
        error: true,
        title: "🔒 Non autorisé",
        message: "Vous devez être connecté pour effectuer cette action.",
      });
    }

    const team = await getTeamForUser();
    
    if (!team) {
      return renderHtml({
        error: true,
        title: "🏢 Équipe introuvable",
        message: "Impossible de trouver votre équipe. Veuillez contacter le support.",
      });
    }

    if (!LINKEDIN_CLIENT_SECRET) {
      return renderHtml({
        error: true,
        title: "⚙️ Configuration manquante",
        message: "LINKEDIN_CLIENT_SECRET n'est pas configuré. Veuillez contacter l'administrateur.",
      });
    }

    const redirectUri = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : url.origin}/api/auth/linkedin/callback`;

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token exchange error:', errorData);
      return renderHtml({
        error: true,
        title: "❌ Échec de l'échange de tokens",
        message: `Erreur ${tokenResponse.status}: Impossible d'obtenir l'access token.`,
        details: errorData,
      });
    }

    const tokenData = await tokenResponse.json();

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000);

    const existing = await db.query.linkedinOAuthCredentials.findFirst({
      where: eq(linkedinOAuthCredentials.teamId, team.id),
    });

    if (existing) {
      await db
        .update(linkedinOAuthCredentials)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || existing.refreshToken,
          expiresAt,
          scope: tokenData.scope || 'openid profile email w_member_social',
          tokenType: tokenData.token_type || 'Bearer',
          connectedBy: user.id,
          connectedAt: new Date(),
          lastRefreshedAt: new Date(),
          isActive: true,
        })
        .where(eq(linkedinOAuthCredentials.teamId, team.id));
    } else {
      await db.insert(linkedinOAuthCredentials).values({
        teamId: team.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        scope: tokenData.scope || 'openid profile email w_member_social',
        tokenType: tokenData.token_type || 'Bearer',
        connectedBy: user.id,
        isActive: true,
      });
    }

    return renderHtml({
      success: true,
      title: "✅ Connexion LinkedIn réussie !",
      message: "Votre compte LinkedIn a été connecté avec succès.",
      details: "Vous pouvez maintenant fermer cette fenêtre et retourner à votre dashboard.",
      redirectUrl: '/dashboard/integrations',
    });

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return renderHtml({
      error: true,
      title: "❌ Erreur interne",
      message: "Une erreur s'est produite lors de la connexion LinkedIn.",
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}

function renderHtml({ 
  error = false, 
  success = false, 
  title, 
  message, 
  details = '', 
  redirectUrl = '' 
}: {
  error?: boolean;
  success?: boolean;
  title: string;
  message: string;
  details?: string;
  redirectUrl?: string;
}) {
  const html = `
    <html>
      <head>
        <title>LinkedIn OAuth - ${error ? 'Erreur' : 'Succès'}</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            padding: 48px;
            max-width: 800px;
            margin: 0 auto;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h1 {
            color: ${error ? '#721c24' : '#0A66C2'};
            margin-top: 0;
          }
          .success {
            background: #d4edda;
            color: #155724;
            padding: 16px;
            border-radius: 4px;
            margin: 16px 0;
          }
          .error {
            background: #f8d7da;
            color: #721c24;
            padding: 16px;
            border-radius: 4px;
            margin: 16px 0;
          }
          .details {
            font-size: 14px;
            color: #666;
            margin-top: 12px;
          }
          .button {
            display: inline-block;
            background: #0A66C2;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin-top: 20px;
          }
          .button:hover {
            background: #004182;
          }
        </style>
        ${redirectUrl && success ? `
          <script>
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 2000);
          </script>
        ` : ''}
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          
          <div class="${error ? 'error' : 'success'}">
            <strong>${message}</strong>
            ${details ? `<div class="details">${details}</div>` : ''}
          </div>
          
          ${redirectUrl ? `
            <p>Redirection automatique dans 2 secondes...</p>
            <a href="${redirectUrl}" class="button">Retourner au dashboard</a>
          ` : ''}
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, { 
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: error ? 400 : 200 
  });
}
