// POST /api/payments — record a customer payment against an invoice.
// Trigger trg_invoice_status recomputes amount_paid and sets unpaid / partial / paid.
import { one } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';

export const POST = handler(async (req) => {
  const user = await requireRole(['admin', 'staff']);
  const { invoiceId, amount, mode, referenceNo } = await req.json();
  const inv = await one('SELECT invoice_id, total_amount, amount_paid, status FROM invoices WHERE invoice_id = $1', [Number(invoiceId)]);
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.status === 'cancelled') throw new HttpError(400, 'This invoice is cancelled');
  const amt = Number(amount);
  if (!(amt > 0)) throw new HttpError(400, 'Enter an amount');
  if (amt > Math.round((inv.total_amount - inv.amount_paid) * 100) / 100) throw new HttpError(400, 'Amount is more than the balance due');

  await one(
    `INSERT INTO customer_payments (invoice_id, amount, mode, reference_no, received_by)
     VALUES ($1, $2, $3, NULLIF($4, ''), $5) RETURNING payment_id`,
    [inv.invoice_id, amt, mode || 'cash', referenceNo || '', user.id],
  );
  return Response.json(await one('SELECT invoice_id, amount_paid, status FROM invoices WHERE invoice_id = $1', [inv.invoice_id]), { status: 201 });
});

export const dynamic = 'force-dynamic';
