// GET /api/reports/daily-sales — view v_daily_sales for the last 30 days
import { q } from '@/lib/db';
import { requireRole, handler } from '@/lib/auth';

export const GET = handler(async () => {
  await requireRole(['admin']);
  return Response.json(await q(
    `SELECT b.code AS branch, d.invoice_date, d.bills, d.revenue, d.gst_collected
       FROM v_daily_sales d JOIN branches b USING (branch_id)
      WHERE d.invoice_date >= CURRENT_DATE - 30 ORDER BY d.invoice_date DESC, b.code`,
  ));
});
