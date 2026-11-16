// GET /api/stock — stock per product per branch, with open low-stock alerts
import { q } from '@/lib/db';
import { requireRole, handler } from '@/lib/auth';

export const GET = handler(async () => {
  await requireRole(['admin', 'staff']);
  return Response.json(await q(
    `SELECT p.product_id, p.sku, p.name, b.code AS branch, s.quantity, p.low_stock_threshold,
            s.quantity <= p.low_stock_threshold AS is_low
       FROM stock s JOIN products p USING (product_id) JOIN branches b USING (branch_id)
      ORDER BY p.name, b.code`,
  ));
});

export const dynamic = 'force-dynamic';
