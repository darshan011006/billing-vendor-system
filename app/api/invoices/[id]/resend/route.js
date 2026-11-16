// POST /api/invoices/:id/resend — send the bill on WhatsApp again
import { one } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { notify } from '@/lib/notify';

export const POST = handler(async (_req, { params }) => {
  await requireRole(['admin', 'staff']);
  const b = await one(
    `SELECT i.invoice_id, i.invoice_no, i.total_amount, cu.name, cu.whatsapp_no
       FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id)
      WHERE i.invoice_id = $1`,
    [Number(params.id)],
  );
  if (!b) throw new HttpError(404, 'Invoice not found');
  const r = await notify({
    type: 'bill',
    to: b.whatsapp_no,
    template: 'bill_receipt',
    ref: { table: 'invoices', id: b.invoice_id },
    payload: { invoiceNo: b.invoice_no, customer: b.name, amount: Number(b.total_amount) },
  });
  return Response.json(r, { status: r.ok ? 200 : 502 });
});

export const dynamic = 'force-dynamic';
