// One command to run everything on localhost:
//   1. starts PostgreSQL 16 (port 5433) and MongoDB 7 (port 27018) with data kept in ./.data
//   2. creates the schema + sample data the first time
//   3. starts Next.js on http://localhost:3000
// Set USE_EMBEDDED_DB=false in .env.local to use databases you installed yourself.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, loadEnv } from './env.mjs';
import { setupDatabases } from './setup-db.mjs';

const env = loadEnv();
const stops = [];

async function startPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const url = new URL(env.DATABASE_URL);
  const dir = path.join(ROOT, '.data', 'pg');
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    persistent: true,
    onLog: () => {},
  });
  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) {
    console.log('Initialising PostgreSQL data folder (first run)...');
    await pg.initialise();
  }
  await pg.start();
  stops.push(() => pg.stop());
  const dbName = url.pathname.slice(1);
  try { await pg.createDatabase(dbName); } catch { /* already exists */ }
  console.log(`PostgreSQL 16 running on port ${url.port} (database ${dbName})`);
}

async function startMongo() {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const url = new URL(env.MONGODB_URI);
    const dbPath = path.join(ROOT, '.data', 'mongo');
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('Starting MongoDB (the first run downloads it, about 70 MB)...');
    const mongod = await MongoMemoryServer.create({
      instance: { port: Number(url.port || 27017), ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
      binary: { version: '7.0.14' },
    });
    stops.push(() => mongod.stop({ doCleanup: false, force: false }));
    console.log(`MongoDB 7 running on port ${url.port}`);
  } catch (err) {
    console.warn(`Could not start MongoDB: ${err.message}\nThe app will run; WhatsApp logs will only be printed here.`);
  }
}

async function shutdown(code = 0) {
  for (const stop of stops.reverse()) { try { await stop(); } catch { /* ignore */ } }
  process.exit(code);
}

(async () => {
  if (String(env.USE_EMBEDDED_DB).toLowerCase() !== 'false') {
    await startPostgres();
    await startMongo();
  }
  await setupDatabases();

  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const next = spawn(process.execPath, [nextBin, 'dev', '-p', '3000'], { cwd: ROOT, stdio: 'inherit', env: process.env });
  console.log('\n  Open http://localhost:3000   (admin/admin123 · staff/staff123 · anita/customer123)\n');
  next.on('exit', (code) => shutdown(code ?? 0));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { next.kill(sig); });
})().catch((err) => {
  console.error(err);
  shutdown(1);
});
