// WhatsApp Cloud API webhook (Meta calls this; it is public, so it checks Meta's signature).
//   GET  verification handshake: echoes hub.challenge when hub.verify_token matches WA_VERIFY_TOKEN
//   POST delivery receipts: { entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp }] } }] }] }
//        -> updates the matching notification_logs document by waMessageId
import crypto from 'node:crypto';
import { tryMongo } from '@/lib/mongo';

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (sp.get('hub.mode') === 'subscribe' && process.env.WA_VERIFY_TOKEN && sp.get('hub.verify_token') === process.env.WA_VERIFY_TOKEN) {
    return new Response(sp.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  const raw = await req.text();
  if (process.env.WA_APP_SECRET) {
    const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WA_APP_SECRET).update(raw).digest('hex');
    const got = req.headers.get('x-hub-signature-256') || '';
    if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
      return new Response('Bad signature', { status: 401 });
    }
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

  const db = await tryMongo();
  if (!db) return Response.json({ updated: 0 }, { status: 503 });
  const logs = db.collection('notification_logs');
  let updated = 0;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const s of change.value?.statuses || []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
        const set = { status: s.status, [`${s.status}At`]: at };
        if (s.status === 'failed') set.error = { code: s.errors?.[0]?.code ?? null, message: s.errors?.[0]?.title || 'Failed' };
        const r = await logs.updateOne({ waMessageId: s.id }, { $set: set, $push: { history: { status: s.status, at, by: 'webhook' } } });
        updated += r.modifiedCount;
      }
    }
  }
  return Response.json({ updated });
}

export const dynamic = 'force-dynamic';
