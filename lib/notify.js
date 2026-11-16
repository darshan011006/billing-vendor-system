// Sends a WhatsApp template message and records it in MongoDB (notification_logs).
import { Int32 } from 'mongodb';
import { tryMongo } from '@/lib/mongo';
import { sendTemplate } from '@/lib/whatsapp';

// WhatsApp numbers are stored as 91XXXXXXXXXX
export function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

// `secret` holds values sent in the message but never written to the log (the OTP code)
export async function notify({ type, to, template, ref, payload, secret = {} }) {
  const db = await tryMongo();
  const logs = db?.collection('notification_logs');
  const doc = {
    type,
    to,
    template,
    status: 'queued',
    attempts: new Int32(0),
    ref: ref ? { table: ref.table, id: new Int32(Number(ref.id)) } : undefined,
    payload: payload || {},
    createdAt: new Date(),
  };
  if (!doc.ref) delete doc.ref;

  let id = null;
  if (logs) {
    try {
      ({ insertedId: id } = await logs.insertOne(doc));
    } catch (err) {
      console.warn('notification log insert failed:', err.message);
    }
  }

  try {
    const { messageId, simulated } = await sendTemplate({ to, template, params: { ...payload, ...secret } });
    if (id) {
      await logs.updateOne(
        { _id: id },
        { $set: { status: 'sent', waMessageId: messageId, simulated, sentAt: new Date() }, $inc: { attempts: 1 }, $push: { history: { status: 'sent', at: new Date() } } },
      );
    }
    return { ok: true, messageId, simulated };
  } catch (err) {
    if (id) {
      await logs.updateOne(
        { _id: id },
        { $set: { status: 'failed', error: { code: err.waCode || null, message: err.message } }, $inc: { attempts: 1 }, $push: { history: { status: 'failed', at: new Date() } } },
      );
    }
    console.warn(`WhatsApp ${template} to ${to} failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}
