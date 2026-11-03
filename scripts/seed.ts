// Reset and reseed the demo database: `npm run seed`
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'podlink.db');
  for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
  const { db } = await import('../src/lib/db');
  const n = (db().prepare('SELECT COUNT(*) c FROM trips').get() as { c: number }).c;
  console.log(`Seeded ${n} trips into ${dbPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
