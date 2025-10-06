import 'dotenv/config';
import { db } from '../lib/db/drizzle';
import { users } from '../lib/db/schema'; // ou une autre table si tu veux tester

async function main() {
    const rows = await db.select().from(users).limit(1);
    console.log('✅ Connexion OK, exemple :', rows);
    process.exit(0);
}

main().catch((e) => {
    console.error('❌ Erreur connexion DB :', e);
    process.exit(1);
});
