import Link from 'next/link';
import { q, one } from '@/lib/db';
import { tryMongo } from '@/lib/mongo';
import { inr, dt, day } from '@/lib/format';
import { StatCard, Badge, PageHeader, Empty } from '@/components/ui';

export default async function AdminDashboard() {
  const [today, receivable, payable, alerts, recent, week] = await Promise.all([
    one(`SELECT COALESCE(SUM(bills), 0) AS bills, COALESCE(SUM(revenue), 0) AS revenue, COALESCE(SUM(gst_collected), 0) AS gst FROM v_daily_sales WHERE invoice_date = CURRENT_DATE`),
    one(`SELECT COALESCE(SUM(total_amount - amount_paid), 0) AS due, COUNT(*) AS n FROM invoices WHERE status IN ('unpaid', 'partial')`),
    one(`SELECT COALESCE(SUM(balance_due), 0) AS due, COUNT(*) FILTER (WHERE balance_due > 0) AS n FROM v_vendor_outstanding`),
    q(`SELECT a.alert_id, p.name, b.code, a.quantity, a.threshold, a.created_at FROM low_stock_alerts a JOIN products p USING (product_id) JOIN branches b USING (branch_id) WHERE a.status = 'open' ORDER BY a.created_at DESC`),
    q(`SELECT i.invoice_id, i.invoice_no, i.total_amount, i.status, cu.name, b.code, o.order_date
         FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id) JOIN branches b ON b.branch_id = o.branch_id
        ORDER BY i.invoice_id DESC LIMIT 8`),
    q(`SELECT d::date AS day, COALESCE(SUM(v.revenue), 0) AS revenue, COALESCE(SUM(v.bills), 0) AS bills
         FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
         LEFT JOIN v_daily_sales v ON v.invoice_date = d::date
        GROUP BY d ORDER BY d`),
  ]);
  const db = await tryMongo();
  const msgs = db ? await db.collection('notification_logs').find().sort({ createdAt: -1 }).limit(6).toArray() : null;
  const max = Math.max(1, ...week.map((w) => w.revenue));

  return (
    <>
      <PageHeader title="Admin Dashboard" sub={`All branches · ${day(new Date())}`}>
        <Link href="/staff/billing" className="btn">+ New bill</Link>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's sales" value={inr(today.revenue)} note={`${today.bills} bills · GST ${inr(today.gst)}`} />
        <StatCard label="To collect from customers" value={inr(receivable.due)} note={`${receivable.n} unpaid / partial invoices`} tone={receivable.due > 0 ? 'warn' : 'good'} />
        <StatCard label="Owed to vendors" value={inr(payable.due)} note={`${payable.n} vendors · v_vendor_outstanding`} tone={payable.due > 0 ? 'bad' : 'good'} />
        <StatCard label="Low-stock alerts" value={alerts.length} note={alerts.map((a) => a.name).join(', ') || 'All stocked'} tone={alerts.length ? 'bad' : 'good'} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="card">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold">Sales, last 7 days</h2><span className="text-xs text-slate-500">from view v_daily_sales</span></div>
          <div className="mt-6 flex h-48 items-end gap-3">
            {week.map((w) => (
              <div key={String(w.day)} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-600">{w.revenue ? inr(w.revenue).replace('.00', '') : ''}</div>
                <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${Math.max(2, (w.revenue / max) * 140)}px`, opacity: w.revenue ? 1 : 0.15 }} />
                <div className="text-[11px] text-slate-500">{new Date(w.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-0">
          <div className="px-5 pt-4 font-semibold">Open low-stock alerts</div>
          <table className="table mt-2"><tbody>
            {alerts.map((a) => <tr key={a.alert_id}><td className="font-medium">{a.name}<div className="text-xs text-slate-400">{a.code} · {dt(a.created_at)}</div></td><td className="text-right font-semibold text-red-600">{a.quantity} / {a.threshold}</td></tr>)}
          </tbody></table>
          {!alerts.length && <Empty>No open alerts</Empty>}
          <div className="px-5 pb-4"><Link href="/admin/purchases" className="text-sm font-semibold text-brand-600">Restock with a purchase →</Link></div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-0">
          <div className="px-5 pt-4 font-semibold">Recent invoices</div>
          <table className="table mt-2"><tbody>
            {recent.map((r) => (
              <tr key={r.invoice_id}>
                <td><Link href={`/invoices/${r.invoice_id}`} className="font-semibold text-brand-600 hover:underline">{r.invoice_no}</Link><div className="text-xs text-slate-400">{dt(r.order_date)}</div></td>
                <td>{r.name}</td><td className="text-right">{inr(r.total_amount)}</td><td><Badge>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody></table>
        </section>
        <section className="card p-0">
          <div className="flex items-baseline justify-between px-5 pt-4"><span className="font-semibold">Latest WhatsApp messages</span><Link href="/admin/notifications" className="text-xs font-semibold text-brand-600">MongoDB log →</Link></div>
          {msgs === null ? <Empty>MongoDB is not running</Empty> : (
            <table className="table mt-2"><tbody>
              {msgs.map((m) => <tr key={String(m._id)}><td className="font-mono text-xs">{m.type}</td><td>{m.payload?.customer || m.payload?.vendor || m.payload?.product || (m.type === 'otp' ? 'login code' : '')}</td><td className="text-xs text-slate-500">{dt(m.createdAt)}</td><td><Badge>{m.status}</Badge></td></tr>)}
            </tbody></table>
          )}
          {msgs && !msgs.length && <Empty>No messages yet</Empty>}
        </section>
      </div>
    </>
  );
}
