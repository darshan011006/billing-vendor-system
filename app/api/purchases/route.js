// POST /api/purchases — record a vendor bill. Trigger trg_purchase_item adds each line to stock
// (and to the purchase total), which also resolves open low-stock alerts.
import { q, tx } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';

export const GET = handler(async () => {
  await requireRole(['admin']);
  return Response.json(await q(
    `SELECT p.*, v.name AS vendor, b.code AS branch FROM purchases p JOIN vendors v USING (vendor_id) JOIN branches b USING (branch_id) ORDER BY purchase_id DESC`,
  ));
});

export const POST = handler(async (req) => {
  await requireRole(['admin']);
  const b = await req.json();
  const items = (b.items || []).filter((i) => i.productId && Number(i.quantity) > 0);
  if (!b.vendorId || !b.branchId) throw new HttpError(400, 'Choose the vendor and the receiving branch');
  if (!String(b.vendorInvoiceNo || '').trim()) throw new HttpError(400, 'Enter the vendor\'s invoice number');
  if (!items.length) throw new HttpError(400, 'Add at least one item');

  const purchase = await tx(async (c) => {
    const { rows: [p] } = await c.query(
      'INSERT INTO purchases (vendor_id, branch_id, vendor_invoice_no, purchase_date) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE)) RETURNING purchase_id',
      [Number(b.vendorId), Number(b.branchId), b.vendorInvoiceNo.trim(), b.purchaseDate || null],
    );
    for (const [i, it] of items.entries()) {
      await c.query(
        `INSERT INTO purchase_items (purchase_id, line_no, product_id, quantity, unit_cost, gst_rate)
         SELECT $1, $2, product_id, $3, $4, gst_rate FROM products WHERE product_id = $5`,
        [p.purchase_id, i + 1, Number(it.quantity), Number(it.unitCost), Number(it.productId)],
      );
    }
    const { rows: [done] } = await c.query('SELECT * FROM purchases WHERE purchase_id = $1', [p.purchase_id]);
    return done;
  });
  return Response.json(purchase, { status: 201 });
});

export const dynamic = 'force-dynamic';
