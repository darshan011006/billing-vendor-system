import Link from 'next/link';
import { q } from '@/lib/db';
import { inr, day } from '@/lib/format';
import { Badge, PageHeader, Empty } from '@/components/ui';

const FILTERS = ['all', 'unpaid', 'partial', 'paid', 'cancelled'];

export default async function InvoicesPage({ searchParams }) {
  const status = FILTERS.includes(searchParams.status) && searchParams.status !== 'all' ? searchParams.status : null;
  const rows = await q(
    `SELECT i.invoice_id, i.invoice_no, i.invoice_date, i.taxable_value, i.cgst + i.sgst AS gst, i.total_amount, i.amount_paid, i.status,
            cu.name AS customer, b.code AS branch
       FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id) JOIN branches b ON b.branch_id = o.branch_id
      WHERE ($1::text IS NULL OR i.status = $1)
      ORDER BY i.invoice_id DESC LIMIT 300`,
    [status],
  );
  const due = rows.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + (r.total_amount - r.amount_paid), 0);
  return (
    <>
      <PageHeader title="Invoices" sub={`${rows.length} invoices · ${inr(due)} still to collect`} />
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`/staff/invoices${f === 'all' ? '' : `?status=${f}`}`} className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${(status || 'all') === f ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{f}</Link>
        ))}
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Invoice no.</th><th>Date</th><th>Customer</th><th>Branch</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice_id}>
                <td><Link className="font-semibold text-brand-600 hover:underline" href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</Link></td>
                <td>{day(r.invoice_date)}</td>
                <td>{r.customer}</td>
                <td>{r.branch}</td>
                <td className="text-right">{inr(r.taxable_value)}</td>
                <td className="text-right">{inr(r.gst)}</td>
                <td className="text-right font-semibold">{inr(r.total_amount)}</td>
                <td className="text-right">{inr(r.amount_paid)}</td>
                <td><Badge>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No invoices</Empty>}
      </div>
    </>
  );
}
