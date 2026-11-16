// POST /api/users — add a login (Admin). A customer login also gets a customers row.
import { q, tx } from '@/lib/db';
import { requireRole, handler, HttpError, hashPassword } from '@/lib/auth';
import { normalisePhone } from '@/lib/notify';

export const GET = handler(async () => {
  await requireRole(['admin']);
  return Response.json(await q('SELECT user_id, username, full_name, role, branch_id, whatsapp_no, is_active FROM users ORDER BY user_id'));
});

export const POST = handler(async (req) => {
  await requireRole(['admin']);
  const b = await req.json();
  const username = String(b.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Username: 3–30 letters, numbers, . or _');
  if (String(b.password || '').length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!['admin', 'staff', 'customer'].includes(b.role)) throw new HttpError(400, 'Choose a role');
  const wa = normalisePhone(b.whatsapp);
  if (!wa) throw new HttpError(400, 'Enter a 10-digit WhatsApp number (the login code is sent there)');
  if (!String(b.fullName || '').trim()) throw new HttpError(400, 'Enter the full name');

  const hash = await hashPassword(b.password);
  const user = await tx(async (c) => {
    const { rows: [u] } = await c.query(
      `INSERT INTO users (branch_id, username, full_name, whatsapp_no, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, role`,
      [b.role === 'customer' ? null : Number(b.branchId) || 1, username, b.fullName.trim(), wa, hash, b.role],
    );
    if (b.role === 'customer') {
      await c.query(
        `INSERT INTO customers (user_id, name, whatsapp_no) VALUES ($1, $2, $3)
         ON CONFLICT (whatsapp_no) DO UPDATE SET user_id = EXCLUDED.user_id WHERE customers.user_id IS NULL`,
        [u.user_id, b.fullName.trim(), wa],
      );
    }
    return u;
  });
  return Response.json(user, { status: 201 });
});
