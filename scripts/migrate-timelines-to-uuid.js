import fs from 'fs';
import readline from 'readline';
import { Client } from 'pg';

const SQL_PATH = './supabase/migrate-timelines-to-uuid.sql';

const ask = (question) => new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (ans) => { rl.close(); resolve(ans); });
});

(async function main(){
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Please set DATABASE_URL environment variable to your Postgres connection string.');
    process.exit(1);
  }

  if (!fs.existsSync(SQL_PATH)) {
    console.error('Migration SQL file not found:', SQL_PATH);
    process.exit(1);
  }

  console.log('About to run timeline id -> uuid migration against:', databaseUrl);
  console.log('This WILL change primary keys and foreign keys. Make a backup first.');

  const confirm = String(await ask('Type YES to continue: ')).trim();
  if (confirm !== 'YES') {
    console.log('Aborting.');
    process.exit(0);
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected. Running migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed, attempting rollback:', err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    process.exit(2);
  } finally {
    await client.end();
  }
})();
