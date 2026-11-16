import Link from 'next/link';
import { q } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { inr, dt } from '@/lib/format';
import { StatCard, Badge, PageHeader, Empty } from '@/components/ui';

export default async function CustomerDashboard() {
  const s = await getSession();
  const rows = await q(
    `SELECT o.order_id, o.order_date, o.status, b.name AS branch, i.invoice_id, i.invoice_no, i.total_amount, i.amount_paid, i.status AS pay_status
       FROM orders o JOIN branches b USING (branch_id) LEFT JOIN invoices i USING (order_id)
      WHERE o.customer_id = $1 ORDER BY o.order_id DESC`,
    [s.customerId || -1],
  );
  const live = rows.filter((r) => r.pay_status !== 'cancelled');
  const spent = live.reduce((t, r) => t + (r.total_amount || 0), 0);
  const due = live.reduce((t, r) => t + ((r.total_amount || 0) - (r.amount_paid || 0)), 0);
  return (
    <>
      <PageHeader title={`Welcome, ${s.name.split(' ')[0]}`} sub="Your orders and bills. Updates also arrive on WhatsApp." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={rows.length} />
        <StatCard label="Total billed" value={inr(spent)} />
        <StatCard label="Balance due" value={inr(due)} tone={due > 0 ? 'warn' : 'good'} />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Store</th><th>Bill</th><th className="text-right">Amount</th><th>Payment</th><th>Order status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.order_id}>
                <td className="font-semibold">#{r.order_id}</td><td>{dt(r.order_date)}</td><td>{r.branch}</td>
                <td>{r.invoice_id ? <Link className="font-medium text-brand-600 hover:underline" href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</Link> : '—'}</td>
                <td className="text-right">{inr(r.total_amount)}</td><td>{r.pay_status && <Badge>{r.pay_status}</Badge>}</td><td><Badge>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No orders yet</Empty>}
      </div>
    </>
  );
}
