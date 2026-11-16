// GET /api/notifications?type=bill&status=failed — WhatsApp log from MongoDB
import { tryMongo } from '@/lib/mongo';
import { requireRole, handler } from '@/lib/auth';

export const GET = handler(async (req) => {
  await requireRole(['admin']);
  const db = await tryMongo();
  if (!db) return Response.json({ error: 'MongoDB is not running' }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get('type')) filter.type = sp.get('type');
  if (sp.get('status')) filter.status = sp.get('status');
  const rows = await db.collection('notification_logs').find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  return Response.json(rows);
});
