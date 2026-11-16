import Link from 'next/link';
import { q } from '@/lib/db';
import { inr, dt } from '@/lib/format';
import { Badge, PageHeader, Empty } from '@/components/ui';
import OrderStatusSelect from '@/components/OrderStatusSelect';

export default async function OrdersPage() {
  const orders = await q(
    `SELECT o.order_id, o.order_date, o.status, b.code AS branch, cu.name AS customer, cu.whatsapp_no,
            i.invoice_id, i.invoice_no, i.total_amount, i.status AS pay_status,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS lines
       FROM orders o JOIN customers cu USING (customer_id) JOIN branches b USING (branch_id)
       LEFT JOIN invoices i USING (order_id)
      ORDER BY o.order_id DESC LIMIT 200`,
  );
  return (
    <>
      <PageHeader title="Orders" sub="Each status change is sent to the customer on WhatsApp">
        <Link href="/staff/billing" className="btn">+ New bill</Link>
      </PageHeader>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Branch</th><th>Items</th><th>Invoice</th><th className="text-right">Total</th><th>Payment</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id}>
                <td className="font-semibold">#{o.order_id}</td>
                <td>{dt(o.order_date)}</td>
                <td>{o.customer}</td>
                <td>{o.branch}</td>
                <td>{o.lines}</td>
                <td className="whitespace-nowrap">{o.invoice_id ? <Link className="font-medium text-brand-600 hover:underline" href={`/invoices/${o.invoice_id}`}>{o.invoice_no}</Link> : '—'}</td>
                <td className="text-right">{inr(o.total_amount)}</td>
                <td>{o.pay_status && <Badge>{o.pay_status}</Badge>}</td>
                <td><Badge>{o.status}</Badge></td>
                <td><OrderStatusSelect orderId={o.order_id} status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <Empty>No orders yet</Empty>}
      </div>
    </>
  );
}
