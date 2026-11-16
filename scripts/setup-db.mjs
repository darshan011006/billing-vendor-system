// Creates the PostgreSQL schema (tables, functions, procedures, triggers, views, roles and
// row-level security), loads the sample data and prepares the MongoDB collections.
//   npm run db:setup   -> only if the database is not set up yet (or is from an older version)
//   npm run db:reset   -> drop everything and start again from the sample data
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ROOT, loadEnv } from './env.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { MongoClient, Int32 } = require('mongodb');
const { initMongo } = require('../db/mongo/init.js');
const { embed, productText, MODEL } = require('../db/mongo/embedding.js');

const SQL_FILES = ['01_ddl.sql', '02_plpgsql.sql', '03_dml.sql', '05_dcl.sql'];

// Says whether the schema exists and is the current version
const VERSION_CHECK = `
  SELECT to_regclass('public.users') IS NOT NULL AS has_tables,
         EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bv_app')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'parent_id')
     AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices') AS is_current`;

export async function setupDatabases({ reset = false, quiet = false } = {}) {
  const env = loadEnv();
  const log = (...a) => !quiet && console.log(...a);
  let products = [];

  const pg = new Client({ connectionString: env.DATABASE_URL });
  await pg.connect();
  try {
    const { rows: [state] } = await pg.query(VERSION_CHECK);
    if (state.has_tables && state.is_current && !reset) {
      log('PostgreSQL schema already set up.');
    } else {
      if (reset) log('Resetting PostgreSQL schema...');
      else if (state.has_tables) log('Upgrading the database (category tree, database roles, row-level security) — reloading sample data...');
      await pg.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
      for (const f of SQL_FILES) {
        await pg.query(fs.readFileSync(path.join(ROOT, 'db', 'postgres', f), 'utf8'));
        log(`  ran db/postgres/${f}`);
      }
      reset = true; // MongoDB documents pointed at the old rows: clear them too
      log('PostgreSQL ready: 16 tables, 5 triggers, 4 functions/procedures, 2 views, 4 database roles + row-level security, sample data.');
    }
    ({ rows: products } = await pg.query(
      `WITH RECURSIVE tree AS (
          SELECT category_id, name::text AS path FROM categories WHERE parent_id IS NULL
          UNION ALL SELECT c.category_id, t.path || ' > ' || c.name FROM categories c JOIN tree t ON c.parent_id = t.category_id)
       SELECT p.product_id, p.sku, p.name, p.hsn_code, tree.path AS category_path
         FROM products p LEFT JOIN tree USING (category_id)`,
    ));
  } finally {
    await pg.end();
  }

  const mongo = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  try {
    await mongo.connect();
    const db = mongo.db();
    if (reset) {
      for (const c of ['notification_logs', 'otp_sessions', 'product_vectors']) await db.collection(c).deleteMany({}).catch(() => {});
    }
    await initMongo(db);
    const vectors = db.collection('product_vectors');
    if ((await vectors.countDocuments()) < products.length) {
      for (const p of products) {
        const text = productText(p);
        await vectors.updateOne(
          { productId: new Int32(p.product_id) },
          { $set: { sku: p.sku, name: p.name, category: p.category_path, text, embedding: embed(text), model: MODEL, updatedAt: new Date() } },
          { upsert: true },
        );
      }
      log(`  embedded ${products.length} products into product_vectors`);
    }
    log('MongoDB ready: notification_logs (validator + 4 indexes), otp_sessions (TTL 5 min), product_vectors (256-d embeddings).');
  } catch (err) {
    console.warn(`MongoDB not reachable (${err.message}). The app will still run; notifications are printed instead of logged.`);
  } finally {
    await mongo.close().catch(() => {});
  }
}

// run directly (npm run db:setup / db:reset); compare case-insensitively for Windows drive letters
if (fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  setupDatabases({ reset: process.argv.includes('--reset') })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
