import { q } from '@/lib/db';
import { requireRole, handler } from '@/lib/auth';

// GET /api/customers?q=98450 — find a saved customer by WhatsApp number or name
export const GET = handler(async (req) => {
  await requireRole(['admin', 'staff']);
  const term = (new URL(req.url).searchParams.get('q') || '').trim();
  if (term.length < 2) return Response.json([]);
  const rows = await q(
    `SELECT customer_id, name, whatsapp_no, customer_type FROM customers
      WHERE whatsapp_no LIKE $1 OR name ILIKE $2 ORDER BY name LIMIT 8`,
    [`%${term.replace(/\D/g, '') || '-'}%`, `%${term}%`],
  );
  return Response.json(rows);
});
