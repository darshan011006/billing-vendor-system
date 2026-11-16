import Link from 'next/link';
import { q } from '@/lib/db';
import { dt, num, inr } from '@/lib/format';
import { PageHeader, Badge, Empty } from '@/components/ui';

export default async function StockPage() {
  const [branches, rows, alerts] = await Promise.all([
    q('SELECT branch_id, code, name FROM branches ORDER BY branch_id'),
    q(`SELECT p.product_id, p.sku, p.name, p.low_stock_threshold, p.cost_price, s.branch_id, s.quantity
         FROM products p LEFT JOIN stock s USING (product_id) ORDER BY p.name`),
    q(`SELECT a.*, p.name, b.code FROM low_stock_alerts a JOIN products p USING (product_id) JOIN branches b USING (branch_id)
        ORDER BY a.status = 'open' DESC, a.created_at DESC LIMIT 50`),
  ]);
  const byProduct = new Map();
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, { ...r, qty: {} });
    if (r.branch_id) byProduct.get(r.product_id).qty[r.branch_id] = r.quantity;
  }
  const value = rows.reduce((s, r) => s + (r.quantity || 0) * r.cost_price, 0);
  const open = alerts.filter((a) => a.status === 'open');

  return (
    <>
      <PageHeader title="Stock & Alerts" sub={`Stock value at cost ${inr(value)} · ${open.length} open low-stock alerts`}>
        <Link href="/admin/purchases" className="btn">Receive stock (purchase)</Link>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card p-0">
          <table className="table">
            <thead><tr><th>SKU</th><th>Product</th>{branches.map((b) => <th key={b.branch_id} className="text-right">{b.code}</th>)}<th className="text-right">Alert at</th></tr></thead>
            <tbody>
              {[...byProduct.values()].map((p) => (
                <tr key={p.product_id}>
                  <td className="font-mono text-xs">{p.sku}</td><td className="font-medium text-slate-900">{p.name}</td>
                  {branches.map((b) => {
                    const v = p.qty[b.branch_id];
                    const low = v !== undefined && v <= p.low_stock_threshold;
                    return <td key={b.branch_id} className={`text-right ${low ? 'font-bold text-red-600' : ''}`}>{v === undefined ? '—' : num(v)}</td>;
                  })}
                  <td className="text-right text-slate-500">{p.low_stock_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card h-fit p-0">
          <div className="px-5 pt-4 font-semibold">Low-stock alerts</div>
          <p className="px-5 text-xs text-slate-500">Raised by trigger trg_low_stock · admins get a WhatsApp message</p>
          <table className="table mt-2">
            <tbody>
              {alerts.map((a) => (
                <tr key={a.alert_id}><td><div className="font-medium">{a.name}</div><div className="text-xs text-slate-400">{a.code} · {dt(a.created_at)}</div></td><td className="text-right">{num(a.quantity)} / {a.threshold}</td><td><Badge>{a.status}</Badge></td></tr>
              ))}
            </tbody>
          </table>
          {!alerts.length && <Empty>No alerts</Empty>}
        </div>
      </div>
    </>
  );
}
