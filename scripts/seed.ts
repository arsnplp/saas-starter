// scripts/seed.ts
import 'dotenv/config';
import { db } from '../lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function main() {
    // 1) USER (obligatoire: email, password_hash)
    const userEmail = 'founder@example.com';
    const passwordHash = 'dev-hash'; // TODO: remplace par un vrai hash plus tard (bcrypt)

    // upsert user par email
    const userRes = await db.execute(sql`
    insert into users (email, password_hash)
    values (${userEmail}, ${passwordHash})
    on conflict (email) do update set email = excluded.email
    returning id, email
  `);
    const user = userRes.rows?.[0];
    if (!user) throw new Error('User insert/select failed');
    console.log('✅ user:', user);

    // 2) TEAM (obligatoire: name)
    const teamName = 'My First Team';
    const teamRes = await db.execute(sql`
    insert into teams (name)
    values (${teamName})
    on conflict do nothing
    returning id, name
  `);

    // si la team existait déjà (on conflict do nothing), on la récupère
    const team =
        teamRes.rows?.[0] ??
        (await db.execute(sql`select id, name from teams where name = ${teamName} limit 1`))
            .rows?.[0];

    if (!team) throw new Error('Team insert/select failed');
    console.log('✅ team:', team);

    // 3) TEAM MEMBERS (obligatoire: user_id, team_id, role)
    const role = 'owner';
    await db.execute(sql`
    insert into team_members (user_id, team_id, role)
    values (${user.id}, ${team.id}, ${role})
    on conflict do nothing
  `);
    console.log('✅ membership ok');

    // 4) LEAD (rien d’obligatoire ; on met un exemple propre)
    await db.execute(sql`
    insert into leads (email, first_name, last_name, company, title, linkedin_url, notes)
    values (
      'contact@acme.test',
      'Ada',
      'Lovelace',
      'Acme Corp',
      'CTO',
      'https://www.linkedin.com/in/ada-lovelace/',
      'Lead de démonstration'
    )
    on conflict do nothing
  `);
    console.log('✅ lead ok');

    // Vérif rapide
    const countLeads = await db.execute(sql`select count(*)::int as c from leads`);
    console.log('📊 leads count:', countLeads.rows?.[0]?.c);

    console.log('🎉 Seed terminé.');
    process.exit(0);
}

main().catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
});
