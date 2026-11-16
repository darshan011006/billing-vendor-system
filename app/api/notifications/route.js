// /api/notifications — WhatsApp log in MongoDB (Admin)
//   GET    ?type=bill&status=failed      read (find + sort + limit)
//   DELETE ?olderThanDays=30             delete many (housekeeping)
import { tryMongo } from '@/lib/mongo';
import { requireRole, handler, HttpError } from '@/lib/auth';

async function logs() {
  const db = await tryMongo();
  if (!db) throw new HttpError(503, 'MongoDB is not running');
  return db.collection('notification_logs');
}

export const GET = handler(async (req) => {
  await requireRole(['admin']);
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get('type')) filter.type = sp.get('type');
  if (sp.get('status')) filter.status = sp.get('status');
  return Response.json(await (await logs()).find(filter).sort({ createdAt: -1 }).limit(200).toArray());
});

export const DELETE = handler(async (req) => {
  await requireRole(['admin']);
  const days = Number(new URL(req.url).searchParams.get('olderThanDays'));
  if (!(days >= 0)) throw new HttpError(400, 'olderThanDays is required');
  const before = new Date(Date.now() - days * 864e5);
  const { deletedCount } = await (await logs()).deleteMany({ createdAt: { $lt: before }, status: { $in: ['delivered', 'read', 'failed'] } });
  return Response.json({ deleted: deletedCount });
});

export const dynamic = 'force-dynamic';
