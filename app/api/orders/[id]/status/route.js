// PATCH /api/orders/:id/status — move an order along (confirmed -> packed -> delivered) or
// cancel it. Cancelling puts the stock back and cancels the invoice; WhatsApp tells the customer.
import { one, tx } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { notify } from '@/lib/notify';

const NEXT = { pending: ['confirmed', 'cancelled'], confirmed: ['packed', 'delivered', 'cancelled'], packed: ['delivered', 'cancelled'], delivered: [], cancelled: [] };

export const PATCH = handler(async (req, { params }) => {
  await requireRole(['admin', 'staff']);
  const { status } = await req.json();
  const id = Number(params.id);

  const result = await tx(async (c) => {
    const { rows: [o] } = await c.query(
      `SELECT o.order_id, o.status, o.branch_id, i.invoice_id, i.amount_paid, cu.whatsapp_no
         FROM orders o JOIN customers cu USING (customer_id) LEFT JOIN invoices i USING (order_id)
        WHERE o.order_id = $1 FOR UPDATE OF o`,
      [id],
    );
    if (!o) throw new HttpError(404, 'Order not found');
    if (!NEXT[o.status].includes(status)) throw new HttpError(400, `Cannot change a ${o.status} order to ${status}`);

    if (status === 'cancelled') {
      if (o.amount_paid > 0) throw new HttpError(400, 'Refund the payments before cancelling this order');
      await c.query(
        `UPDATE stock s SET quantity = s.quantity + oi.qty, updated_at = now()
           FROM (SELECT product_id, SUM(quantity) AS qty FROM order_items WHERE order_id = $1 GROUP BY product_id) oi
          WHERE s.product_id = oi.product_id AND s.branch_id = $2`,
        [id, o.branch_id],
      );
      if (o.invoice_id) await c.query("UPDATE invoices SET status = 'cancelled' WHERE invoice_id = $1", [o.invoice_id]);
    }
    await c.query('UPDATE orders SET status = $1 WHERE order_id = $2', [status, id]);
    return { from: o.status, to: status, whatsapp: o.whatsapp_no };
  });

  await notify({
    type: 'order_status',
    to: result.whatsapp,
    template: 'order_update',
    ref: { table: 'orders', id },
    payload: { orderId: id, from: result.from, to: result.to },
  });
  return Response.json(await one('SELECT order_id, status FROM orders WHERE order_id = $1', [id]));
});

export const dynamic = 'force-dynamic';
