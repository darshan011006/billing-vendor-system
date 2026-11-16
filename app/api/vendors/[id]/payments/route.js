// POST /api/vendors/:id/payments — pay a vendor and confirm it on WhatsApp.
// sp_record_vendor_payment rejects over-payment; trigger trg_vendor_payment updates the purchase.
import { pool, one } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { notify } from '@/lib/notify';

export const POST = handler(async (req, { params }) => {
  const user = await requireRole(['admin']);
  const { purchaseId, amount, mode, referenceNo } = await req.json();
  const amt = Number(amount);
  if (!(amt > 0)) throw new HttpError(400, 'Enter an amount');
  if (mode !== 'cash' && !String(referenceNo || '').trim()) throw new HttpError(400, 'Enter the UPI / cheque / NEFT reference');

  await pool.query('CALL sp_record_vendor_payment($1, $2, $3, $4, $5, $6)', [
    Number(params.id), purchaseId ? Number(purchaseId) : null, amt, mode, referenceNo || null, user.id,
  ]);

  const v = await one('SELECT vendor_id, name, whatsapp_no, fn_vendor_balance(vendor_id) AS balance FROM vendors WHERE vendor_id = $1', [Number(params.id)]);
  const last = await one('SELECT vendor_payment_id FROM vendor_payments WHERE vendor_id = $1 ORDER BY vendor_payment_id DESC LIMIT 1', [v.vendor_id]);
  const wa = await notify({
    type: 'vendor_payment',
    to: v.whatsapp_no,
    template: 'vendor_paid_slip',
    ref: { table: 'vendor_payments', id: last.vendor_payment_id },
    payload: { vendor: v.name, amount: amt, mode, utr: referenceNo || null, balanceAfter: Number(v.balance) },
  });
  return Response.json({ ok: true, balance: v.balance, whatsapp: wa }, { status: 201 });
});
