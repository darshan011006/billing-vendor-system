// Password hashing, JWT session cookies and role checks.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');

export const SESSION_COOKIE = 'session';
export const PENDING_COOKIE = 'pending_login';

export async function sign(payload, expiresIn) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresIn).sign(secret());
}

export async function verify(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);
export const hashPassword = (plain) => bcrypt.hash(plain, 10);

// Current signed-in user (server components and route handlers)
export async function getSession() {
  const s = await verify(cookies().get(SESSION_COOKIE)?.value);
  return s && s.otpVerified ? s : null;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(roles) {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Please sign in');
  if (!roles.includes(s.role)) throw new HttpError(403, 'Not allowed for your role');
  return s;
}

// Wraps a route handler: turns thrown errors (incl. PostgreSQL RAISE EXCEPTION) into JSON
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const status = err.status || (err.code ? 400 : 500);
      if (status === 500) console.error(err);
      return Response.json({ error: err.message }, { status });
    }
  };
}
