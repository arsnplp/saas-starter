// scripts/print-schema.ts
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

// Les tables qu'on veut inspecter (tu peux en ajouter/retirer)
const TABLES = ['users', 'teams', 'team_members', 'leads'];

// On construit la requête SQL sans backticks pour éviter les erreurs d'analyse
const q = [
    'select',
    '  c.table_name,',
    '  c.column_name,',
    '  c.data_type,',
    '  c.is_nullable,',
    '  c.column_default',
    'from information_schema.columns c',
    "where c.table_schema = 'public'",
    '  and c.table_name = any($1::text[])',
    'order by c.table_name, c.ordinal_position;'
].join('\n');

async function main() {
    const client = new Client({
        connectionString: process.env.POSTGRES_URL, // pooler suffit pour un SELECT
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    const res = await client.query(q, [TABLES]);

    let current: string | null = null;
    for (const r of res.rows as any[]) {
        if (r.table_name !== current) {
            current = r.table_name;
            console.log(`\n=== ${current} ===`);
            console.log('colonne               type               NOT NULL   default');
            console.log('----------------------------------------------------------');
        }
        const nn = r.is_nullable === 'NO' ? 'YES' : 'no';
        const def = r.column_default ?? '';
        console.log(
            String(r.column_name).padEnd(20),
            String(r.data_type).padEnd(18),
            nn.padEnd(9),
            def
        );
    }

    await client.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
