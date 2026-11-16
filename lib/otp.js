// Login OTPs: 6 digits, hashed in MongoDB otp_sessions (TTL index removes them after 5 min),
// sent on WhatsApp. Falls back to memory if MongoDB is down.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { tryMongo } from '@/lib/mongo';
import { notify } from '@/lib/notify';
import { isDemoMode } from '@/lib/whatsapp';

const g = globalThis;
const memory = g.__otpMemory || (g.__otpMemory = new Map());
const TTL_MS = 5 * 60 * 1000;
const MAX_TRIES = 5;

export async function issueOtp(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const session = { userId: user.user_id, otpHash: await bcrypt.hash(code, 8), tries: 0, createdAt: new Date() };

  const db = await tryMongo();
  if (db) {
    await db.collection('otp_sessions').deleteMany({ userId: user.user_id });
    await db.collection('otp_sessions').insertOne(session);
  } else {
    memory.set(user.user_id, session);
  }

  await notify({
    type: 'otp',
    to: user.whatsapp_no,
    template: 'login_otp',
    ref: { table: 'users', id: user.user_id },
    payload: { purpose: 'login' },
    secret: { code },
  });

  return isDemoMode() ? code : null; // shown on screen only in demo mode
}

export async function verifyOtp(userId, code) {
  const db = await tryMongo();
  const col = db?.collection('otp_sessions');
  const session = col ? await col.findOne({ userId }) : memory.get(userId);
  if (!session || Date.now() - new Date(session.createdAt).getTime() > TTL_MS) return { ok: false, error: 'Code expired. Sign in again.' };
  if (session.tries >= MAX_TRIES) return { ok: false, error: 'Too many wrong codes. Sign in again.' };

  const ok = await bcrypt.compare(String(code || ''), session.otpHash);
  if (!ok) {
    if (col) await col.updateOne({ _id: session._id }, { $inc: { tries: 1 } });
    else session.tries += 1;
    return { ok: false, error: 'Wrong code' };
  }
  if (col) await col.deleteOne({ _id: session._id });
  else memory.delete(userId);
  return { ok: true };
}
