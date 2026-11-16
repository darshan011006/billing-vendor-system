// Every minute, re-sends WhatsApp messages that failed (up to 3 attempts). OTPs are never
// re-sent: their code is not stored, and a new login issues a new one.
import { tryMongo } from '@/lib/mongo';
import { sendTemplate } from '@/lib/whatsapp';

export function startRetryWorker() {
  const g = globalThis;
  if (g.__retryWorker) return;
  g.__retryWorker = setInterval(async () => {
    const db = await tryMongo();
    if (!db) return;
    const logs = db.collection('notification_logs');
    const failed = await logs
      .find({ status: 'failed', attempts: { $lt: 3 }, type: { $ne: 'otp' } }, { projection: { to: 1, template: 1, payload: 1 } })
      .sort({ createdAt: 1 })
      .limit(20)
      .toArray();
    for (const m of failed) {
      try {
        const { messageId, simulated } = await sendTemplate({ to: m.to, template: m.template, params: m.payload });
        await logs.updateOne({ _id: m._id }, { $set: { status: 'sent', waMessageId: messageId, simulated }, $inc: { attempts: 1 }, $push: { history: { status: 'sent', at: new Date(), retry: true } } });
      } catch (err) {
        await logs.updateOne({ _id: m._id }, { $set: { error: { message: err.message } }, $inc: { attempts: 1 } });
      }
    }
  }, 60_000);
}
