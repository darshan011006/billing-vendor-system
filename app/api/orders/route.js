// POST /api/orders — create an order and bill it in one PostgreSQL transaction:
//   insert order -> insert lines (trigger T1 deducts stock, T2 may raise a low-stock alert)
//   -> CALL sp_generate_invoice -> optional payment (trigger T3 sets invoice status)
// then send the bill on WhatsApp and log it in MongoDB.
import { q, tx } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { notify, normalisePhone } from '@/lib/notify';

export const POST = handler(async (req) => {
  const user = await requireRole(['admin', 'staff']);
  const body = await req.json();
  const branchId = user.role === 'admin' && body.branchId ? Number(body.branchId) : user.branchId;
  const items = (body.items || []).filter((i) => Number(i.quantity) > 0);
  if (!items.length) throw new HttpError(400, 'Add at least one item');

  const bill = await tx(async (c) => {
    // customer: an existing one, or create/update by WhatsApp number
    let customerId = Number(body.customer?.customerId) || null;
    if (!customerId) {
      const wa = normalisePhone(body.customer?.phone);
      const name = String(body.customer?.name || '').trim();
      if (!name) throw new HttpError(400, 'Customer name is required');
      if (!wa) throw new HttpError(400, 'Enter a 10-digit WhatsApp number');
      const { rows: [cu] } = await c.query(
        `INSERT INTO customers (name, whatsapp_no) VALUES ($1, $2)
         ON CONFLICT (whatsapp_no) DO UPDATE SET name = EXCLUDED.name RETURNING customer_id`,
        [name, wa],
      );
      customerId = cu.customer_id;
    }

    const { rows: [order] } = await c.query(
      'INSERT INTO orders (branch_id, customer_id, created_by) VALUES ($1, $2, $3) RETURNING order_id',
      [branchId, customerId, user.id],
    );

    for (const [i, it] of items.entries()) {
      const r = await c.query(
        `INSERT INTO order_items (order_id, line_no, product_id, quantity, unit_price, discount, gst_rate)
         SELECT $1, $2, product_id, $3, selling_price, LEAST($5::numeric, $3 * selling_price), gst_rate
           FROM products WHERE product_id = $4`,
        [order.order_id, i + 1, Number(it.quantity), Number(it.productId), Number(it.discount || 0)],
      );
      if (r.rowCount !== 1) throw new HttpError(400, `Product ${it.productId} not found`);
    }

    const { rows: [inv] } = await c.query('CALL sp_generate_invoice($1, NULL)', [order.order_id]);
    const { rows: [info] } = await c.query(
      `SELECT i.invoice_id, i.invoice_no, i.total_amount, cu.name, cu.whatsapp_no
         FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id)
        WHERE i.invoice_no = $1`,
      [inv.p_invoice_no],
    );

    const paid = Number(body.payment?.amount || 0);
    if (paid > 0) {
      if (paid > info.total_amount) throw new HttpError(400, 'Amount received is more than the bill total');
      await c.query(
        `INSERT INTO customer_payments (invoice_id, amount, mode, reference_no, received_by)
         VALUES ($1, $2, $3, NULLIF($4, ''), $5)`,
        [info.invoice_id, paid, body.payment.mode || 'cash', body.payment.referenceNo || '', user.id],
      );
    }
    return { orderId: order.order_id, ...info };
  });

  const wa = await notify({
    type: 'bill',
    to: bill.whatsapp_no,
    template: 'bill_receipt',
    ref: { table: 'invoices', id: bill.invoice_id },
    payload: { invoiceNo: bill.invoice_no, customer: bill.name, amount: Number(bill.total_amount) },
  });

  return Response.json({ orderId: bill.orderId, invoiceId: bill.invoice_id, invoiceNo: bill.invoice_no, whatsapp: wa }, { status: 201 });
});

// GET /api/orders — latest orders (customers see only their own)
export const GET = handler(async () => {
  const user = await requireRole(['admin', 'staff', 'customer']);
  const rows = await q(
    `SELECT o.order_id, o.order_date, o.status, c.name AS customer, i.invoice_no, i.total_amount, i.status AS payment_status
       FROM orders o JOIN customers c USING (customer_id) LEFT JOIN invoices i USING (order_id)
      WHERE ($1::int IS NULL OR o.customer_id = $1)
      ORDER BY o.order_id DESC LIMIT 100`,
    [user.role === 'customer' ? user.customerId : null],
  );
  return Response.json(rows);
});
