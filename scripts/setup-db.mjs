// Creates the PostgreSQL schema (tables, functions, procedures, triggers, views), loads the
// sample data and prepares the MongoDB collections.
//   npm run db:setup   -> only if the tables are not there yet
//   npm run db:reset   -> drop everything and start again from the sample data
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ROOT, loadEnv } from './env.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const { initMongo } = require('../db/mongo/init.js');

const SQL_FILES = ['01_ddl.sql', '02_plpgsql.sql', '03_dml.sql'];

export async function setupDatabases({ reset = false, quiet = false } = {}) {
  const env = loadEnv();
  const log = (...a) => !quiet && console.log(...a);

  const pg = new Client({ connectionString: env.DATABASE_URL });
  await pg.connect();
  try {
    const { rows } = await pg.query("SELECT to_regclass('public.users') IS NOT NULL AS ready");
    if (rows[0].ready && !reset) {
      log('PostgreSQL schema already set up.');
    } else {
      if (reset) log('Resetting PostgreSQL schema...');
      await pg.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
      for (const f of SQL_FILES) {
        await pg.query(fs.readFileSync(path.join(ROOT, 'db', 'postgres', f), 'utf8'));
        log(`  ran db/postgres/${f}`);
      }
      log('PostgreSQL ready: 16 tables, 5 triggers, 4 functions/procedures, 2 views, sample data.');
    }
  } finally {
    await pg.end();
  }

  const mongo = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  try {
    await mongo.connect();
    const db = mongo.db();
    if (reset) {
      await db.collection('notification_logs').deleteMany({}).catch(() => {});
      await db.collection('otp_sessions').deleteMany({}).catch(() => {});
    }
    await initMongo(db);
    log('MongoDB ready: notification_logs (validator + 4 indexes), otp_sessions (TTL 5 min).');
  } catch (err) {
    console.warn(`MongoDB not reachable (${err.message}). The app will still run; notifications are printed instead of logged.`);
  } finally {
    await mongo.close().catch(() => {});
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  setupDatabases({ reset: process.argv.includes('--reset') })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
