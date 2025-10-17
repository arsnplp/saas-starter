import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const html = `
    <html>
      <head>
        <title>LinkedIn OAuth Callback</title>
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
            color: #0A66C2;
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
          code {
            background: #f4f4f4;
            padding: 4px 8px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
          }
          .label {
            font-weight: 600;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔗 LinkedIn OAuth Callback</h1>
          
          ${error ? `
            <div class="error">
              <strong>❌ Erreur d'autorisation</strong><br><br>
              <strong>Erreur:</strong> ${error}<br>
              ${errorDesc ? `<strong>Description:</strong> ${errorDesc}` : ''}
            </div>
          ` : ''}
          
          ${code ? `
            <div class="success">
              <strong>✅ Code d'autorisation reçu avec succès!</strong><br><br>
              <div class="label">Code:</div>
              <code>${code}</code><br><br>
              <p>📋 Copiez ce code et utilisez-le pour obtenir votre access token LinkedIn.</p>
            </div>
          ` : !error ? `
            <div class="error">
              <strong>⚠️ Aucun code reçu</strong><br><br>
              Aucun code d'autorisation n'a été trouvé dans la réponse.
            </div>
          ` : ''}
          
          ${state ? `
            <div class="label">State:</div>
            <code>${state}</code>
          ` : ''}
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, { 
    headers: { "Content-Type": "text/html" },
    status: 200 
  });
}
