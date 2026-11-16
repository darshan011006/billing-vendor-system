// LISTEN low_stock: trigger trg_low_stock calls pg_notify('low_stock', …) when an item drops
// to its alert level. This worker turns each notification into a WhatsApp alert to every admin.
import pg from 'pg';
import { q, one } from '@/lib/db';
import { notify } from '@/lib/notify';

export async function startLowStockListener() {
  const g = globalThis;
  if (g.__lowStockListener) return;
  g.__lowStockListener = true;

  const connect = async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    client.on('error', () => {});
    client.on('end', () => setTimeout(connect, 5000));
    try {
      await client.connect();
      await client.query('LISTEN low_stock');
      client.on('notification', async (msg) => {
        try {
          const { product_id, branch_id, qty } = JSON.parse(msg.payload);
          const info = await one(
            `SELECT p.name AS product, p.low_stock_threshold AS threshold, b.name AS branch
               FROM products p, branches b WHERE p.product_id = $1 AND b.branch_id = $2`,
            [product_id, branch_id],
          );
          const admins = await q("SELECT whatsapp_no FROM users WHERE role = 'admin' AND is_active");
          for (const a of admins) {
            await notify({
              type: 'low_stock',
              to: a.whatsapp_no,
              template: 'low_stock_alert',
              ref: { table: 'products', id: product_id },
              payload: { product: info.product, branch: info.branch, qty: Number(qty), threshold: info.threshold },
            });
          }
        } catch (err) {
          console.warn('low-stock alert failed:', err.message);
        }
      });
      console.log('[worker] listening for low_stock notifications');
    } catch {
      setTimeout(connect, 5000);
    }
  };
  connect();
}
