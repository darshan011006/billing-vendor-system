// PostgreSQL connection pool (node-postgres). One pool per server process.
import pg from 'pg';

// NUMERIC -> JS number, so amounts can be added and formatted directly
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const g = globalThis;
export const pool =
  g.__pgPool ||
  (g.__pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));

export async function q(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function one(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

// Runs fn(client) inside BEGIN ... COMMIT, rolling back on any error.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
