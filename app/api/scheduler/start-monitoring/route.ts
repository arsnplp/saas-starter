import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { webhookAccounts } from '@/lib/db/schema';
import { WebhookManager } from '@/lib/services/webhook-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.INGEST_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    console.log('⏰ === SCHEDULER: DÉMARRAGE MONITORING ===');

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('⏭️ Weekend - pas de démarrage');
      return NextResponse.json({
        message: 'Weekend - monitoring non démarré',
        skipped: true,
      });
    }

    console.log(`📅 ${now.toISOString()} - Démarrage monitoring`);

    const accounts = await db.query.webhookAccounts.findMany({
      where: (webhookAccounts, { eq }) => eq(webhookAccounts.isActive, false),
    });

    console.log(`📊 ${accounts.length} comptes à démarrer`);

    const results = [];

    for (const account of accounts) {
      try {
        console.log(`\n▶️ Démarrage team ${account.teamId}...`);
        const result = await WebhookManager.startMonitoring(account.teamId);
        results.push({
          teamId: account.teamId,
          success: true,
          isActive: result.account.isActive,
        });
        console.log(`✅ Team ${account.teamId} démarrée`);
      } catch (error: any) {
        console.error(`❌ Erreur team ${account.teamId}:`, error.message);
        results.push({
          teamId: account.teamId,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`\n✅ === RÉSULTAT ===`);
    console.log(`Succès: ${successCount}`);
    console.log(`Échecs: ${failureCount}`);

    return NextResponse.json({
      message: 'Démarrage monitoring terminé',
      timestamp: now.toISOString(),
      totalAccounts: accounts.length,
      success: successCount,
      failures: failureCount,
      results,
    });
  } catch (error: any) {
    console.error('❌ Erreur scheduler:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    scheduler: 'start-monitoring',
    description: 'Démarre le monitoring LinkedIn en semaine',
    schedule: 'Lundi-Vendredi 8h00',
  });
}
