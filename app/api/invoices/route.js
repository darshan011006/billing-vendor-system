// GET /api/invoices?status=unpaid — invoices (customers see only their own)
import { q } from '@/lib/db';
import { requireRole, handler } from '@/lib/auth';

export const GET = handler(async (req) => {
  const user = await requireRole(['admin', 'staff', 'customer']);
  const status = new URL(req.url).searchParams.get('status');
  const rows = await q(
    `SELECT i.invoice_id, i.invoice_no, i.invoice_date, i.total_amount, i.amount_paid, i.status, cu.name AS customer
       FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id)
      WHERE ($1::text IS NULL OR i.status = $1) AND ($2::int IS NULL OR o.customer_id = $2)
      ORDER BY i.invoice_id DESC LIMIT 200`,
    [status || null, user.role === 'customer' ? user.customerId : null],
  );
  return Response.json(rows);
});
