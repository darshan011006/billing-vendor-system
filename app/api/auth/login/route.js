import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { checkPassword, sign, handler, PENDING_COOKIE } from '@/lib/auth';
import { issueOtp } from '@/lib/otp';

export const POST = handler(async (req) => {
  const { username, password } = await req.json();
  const user = await one('SELECT * FROM users WHERE username = $1 AND is_active', [String(username || '').trim().toLowerCase()]);
  if (!user || !(await checkPassword(String(password || ''), user.password_hash))) {
    return Response.json({ error: 'Wrong username or password' }, { status: 401 });
  }

  const devOtp = await issueOtp(user);
  cookies().set(PENDING_COOKIE, await sign({ uid: user.user_id }, '5m'), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 });
  return Response.json({ ok: true, to: user.whatsapp_no, devOtp });
});
