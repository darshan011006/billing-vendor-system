// /api/notifications/:id — one WhatsApp log document (Admin)
//   PATCH  { status: 'delivered' | 'read' | 'failed' }   update ($set + $push to history)
//   DELETE                                               delete one
import { ObjectId } from 'mongodb';
import { tryMongo } from '@/lib/mongo';
import { requireRole, handler, HttpError } from '@/lib/auth';

async function target(id) {
  const db = await tryMongo();
  if (!db) throw new HttpError(503, 'MongoDB is not running');
  if (!ObjectId.isValid(id)) throw new HttpError(400, 'Bad id');
  return { col: db.collection('notification_logs'), _id: new ObjectId(id) };
}

export const PATCH = handler(async (req, { params }) => {
  await requireRole(['admin']);
  const { status } = await req.json();
  if (!['delivered', 'read', 'failed'].includes(status)) throw new HttpError(400, 'status must be delivered, read or failed');
  const { col, _id } = await target(params.id);
  const r = await col.findOneAndUpdate(
    { _id },
    { $set: { status, [`${status}At`]: new Date() }, $push: { history: { status, at: new Date(), by: 'admin' } } },
    { returnDocument: 'after' },
  );
  if (!r) throw new HttpError(404, 'Message not found');
  return Response.json({ _id: r._id, status: r.status, history: r.history });
});

export const DELETE = handler(async (_req, { params }) => {
  await requireRole(['admin']);
  const { col, _id } = await target(params.id);
  const { deletedCount } = await col.deleteOne({ _id });
  if (!deletedCount) throw new HttpError(404, 'Message not found');
  return Response.json({ deleted: 1 });
});

export const dynamic = 'force-dynamic';
