import Link from 'next/link';
import { q, one } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { inr, dt } from '@/lib/format';
import { StatCard, Badge, PageHeader } from '@/components/ui';

export default async function StaffDashboard() {
  const s = await getSession();
  const [today, due, alerts, recent] = await Promise.all([
    one(`SELECT COALESCE(SUM(bills), 0) AS bills, COALESCE(SUM(revenue), 0) AS revenue FROM v_daily_sales WHERE branch_id = $1 AND invoice_date = CURRENT_DATE`, [s.branchId]),
    one(`SELECT COALESCE(SUM(i.total_amount - i.amount_paid), 0) AS due, COUNT(*) AS n FROM invoices i JOIN orders o USING (order_id) WHERE o.branch_id = $1 AND i.status IN ('unpaid', 'partial')`, [s.branchId]),
    q(`SELECT p.name, a.quantity, a.threshold FROM low_stock_alerts a JOIN products p USING (product_id) WHERE a.branch_id = $1 AND a.status = 'open' ORDER BY a.created_at DESC`, [s.branchId]),
    q(`SELECT i.invoice_id, i.invoice_no, i.total_amount, i.status, cu.name, o.order_date FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id) WHERE o.branch_id = $1 ORDER BY i.invoice_id DESC LIMIT 8`, [s.branchId]),
  ]);
  return (
    <>
      <PageHeader title={`Hello, ${s.name.split(' ')[0]}`} sub={`${s.branchName} · today`}>
        <Link href="/staff/billing" className="btn">+ New bill</Link>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Today's sales" value={inr(today.revenue)} note={`${today.bills} bills`} />
        <StatCard label="To collect" value={inr(due.due)} note={`${due.n} unpaid / partly paid bills`} tone={due.due > 0 ? 'warn' : 'good'} />
        <StatCard label="Low-stock items" value={alerts.length} tone={alerts.length ? 'bad' : 'good'} note={alerts.map((a) => a.name).join(', ') || 'All good'} />
      </div>
      <div className="card p-0">
        <div className="px-5 pt-4 font-semibold">Recent bills</div>
        <table className="table mt-2">
          <tbody>
            {recent.map((r) => (
              <tr key={r.invoice_id}>
                <td><Link className="font-semibold text-brand-600 hover:underline" href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</Link></td>
                <td>{r.name}</td><td>{dt(r.order_date)}</td><td className="text-right">{inr(r.total_amount)}</td><td><Badge>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
