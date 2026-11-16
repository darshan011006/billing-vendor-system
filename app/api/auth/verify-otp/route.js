import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { sign, verify, handler, SESSION_COOKIE, PENDING_COOKIE } from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

export const POST = handler(async (req) => {
  const { code } = await req.json();
  const pending = await verify(cookies().get(PENDING_COOKIE)?.value);
  if (!pending) return Response.json({ error: 'Your sign-in expired. Start again.' }, { status: 401 });

  const result = await verifyOtp(pending.uid, code);
  if (!result.ok) return Response.json({ error: result.error }, { status: 401 });

  const u = await one(
    `SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, b.name AS branch_name, c.customer_id
       FROM users u LEFT JOIN branches b ON b.branch_id = u.branch_id
       LEFT JOIN customers c ON c.user_id = u.user_id
      WHERE u.user_id = $1`,
    [pending.uid],
  );
  const token = await sign(
    { id: u.user_id, username: u.username, name: u.full_name, role: u.role, branchId: u.branch_id, branchName: u.branch_name, customerId: u.customer_id, otpVerified: true },
    '8h',
  );
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 3600 });
  cookies().delete(PENDING_COOKIE);
  const redirect = u.role === 'admin' ? '/admin/dashboard' : u.role === 'staff' ? '/staff/dashboard' : '/customer/dashboard';
  return Response.json({ ok: true, redirect });
});

export const dynamic = 'force-dynamic';
