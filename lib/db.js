// PostgreSQL access with role-based access control enforced BY THE DATABASE.
//
// The pool logs in as bv_app (no table rights of its own). Every query runs inside a
// transaction that first does   SET LOCAL ROLE erp_<role>   for the signed-in user, and
// stores their ids in app.user_id / app.customer_id for the row-level-security policies
// (db/postgres/05_dcl.sql). So a staff login physically cannot read vendors, and a customer
// login only ever sees their own orders and invoices — even if the app code had a bug.
import pg from 'pg';
import { getSession } from '@/lib/auth';

// NUMERIC -> JS number, so amounts can be added and formatted directly
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

export function appDatabaseUrl() {
  if (process.env.APP_DATABASE_URL) return process.env.APP_DATABASE_URL;
  const u = new URL(process.env.DATABASE_URL);
  u.username = 'bv_app';
  u.password = 'bv_app_pw';
  return u.toString();
}

const g = globalThis;
export const pool = g.__pgPool || (g.__pgPool = new pg.Pool({ connectionString: appDatabaseUrl(), max: 12 }));

const ROLES = { admin: 'erp_admin', staff: 'erp_staff', customer: 'erp_customer' };

// Which database role this code runs as
export async function dbContext() {
  try {
    const s = await getSession(); // reads the request cookie
    if (s) return { role: ROLES[s.role], userId: s.id, customerId: s.customerId || null };
    return { role: 'erp_auth', userId: null, customerId: null }; // in a request, not signed in
  } catch (err) {
    // only code with no request at all (the background workers) runs as erp_admin
    if (/outside a request scope/i.test(String(err?.message))) return { role: 'erp_admin', userId: null, customerId: null, system: true };
    throw err;
  }
}

async function begin(client, ctx) {
  if (!Object.values(ROLES).concat('erp_auth').includes(ctx.role)) throw new Error('Unknown database role');
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE ${ctx.role}`);
  await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.customer_id', $2, true)", [
    ctx.userId ? String(ctx.userId) : '',
    ctx.customerId ? String(ctx.customerId) : '',
  ]);
}

// Runs fn(client) inside BEGIN ... COMMIT as the current user's database role.
export async function tx(fn, ctx) {
  const context = ctx || (await dbContext());
  const client = await pool.connect();
  try {
    await begin(client, context);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function q(text, params, ctx) {
  return tx(async (c) => (await c.query(text, params)).rows, ctx);
}

export async function one(text, params, ctx) {
  const rows = await q(text, params, ctx);
  return rows[0] || null;
}

// Runs one statement as a chosen database role and always rolls back (Security page tests).
// role null = bv_app itself, with no SET ROLE.
export async function tryAs(role, customerId, text) {
  const client = await pool.connect();
  try {
    if (role) await begin(client, { role, userId: null, customerId });
    else await client.query('BEGIN');
    const r = await client.query(text);
    return { ok: true, rows: r.rows, rowCount: r.rowCount };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
