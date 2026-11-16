import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { tryMongo } from '@/lib/mongo';
import { inr, dt, day, phone } from '@/lib/format';
import { Badge } from '@/components/ui';
import { PrintButton, ResendButton, PaymentForm } from '@/components/InvoiceActions';

export default async function InvoicePage({ params, searchParams }) {
  const s = await getSession();
  const inv = await one(
    `SELECT i.*, o.order_id, o.status AS order_status, o.customer_id, o.order_date,
            cu.name AS customer, cu.whatsapp_no, cu.gstin AS customer_gstin,
            b.name AS branch, b.address AS branch_address, b.gstin AS branch_gstin, b.phone AS branch_phone,
            u.full_name AS billed_by
       FROM invoices i JOIN orders o USING (order_id) JOIN customers cu USING (customer_id)
       JOIN branches b ON b.branch_id = o.branch_id JOIN users u ON u.user_id = o.created_by
      WHERE i.invoice_id = $1`,
    [Number(params.id)],
  );
  if (!inv || (s.role === 'customer' && inv.customer_id !== s.customerId)) notFound();

  const [lines, payments] = await Promise.all([
    q(`SELECT oi.*, p.name, p.sku, p.hsn_code FROM order_items oi JOIN products p USING (product_id) WHERE oi.order_id = $1 ORDER BY line_no`, [inv.order_id]),
    q(`SELECT cp.*, u.full_name AS received_by_name FROM customer_payments cp LEFT JOIN users u ON u.user_id = cp.received_by WHERE invoice_id = $1 ORDER BY paid_at`, [inv.invoice_id]),
  ]);
  const db = await tryMongo();
  const messages = db
    ? await db.collection('notification_logs').find({ 'ref.table': 'invoices', 'ref.id': inv.invoice_id }).sort({ createdAt: -1 }).limit(5).toArray()
    : [];
  const balance = Math.round((inv.total_amount - inv.amount_paid) * 100) / 100;
  const staff = s.role !== 'customer';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {searchParams.new && (
        <div className="no-print rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Bill saved as <b>{inv.invoice_no}</b>{messages[0] ? ` and sent to ${phone(inv.whatsapp_no)} on WhatsApp${messages[0].simulated ? ' (demo mode)' : ''}` : ''}.
        </div>
      )}
      <div className="no-print flex justify-end gap-2">
        {staff && <ResendButton invoiceId={inv.invoice_id} />}
        <PrintButton />
      </div>

      <article className="card print-full p-8">
        <header className="flex justify-between border-b pb-5">
          <div>
            <div className="text-xl font-bold">{inv.branch}</div>
            <div className="text-sm text-slate-500">{inv.branch_address}</div>
            <div className="text-sm text-slate-500">GSTIN {inv.branch_gstin} · Ph {inv.branch_phone}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax invoice</div>
            <div className="text-lg font-bold">{inv.invoice_no}</div>
            <div className="text-sm text-slate-500">{day(inv.invoice_date)}</div>
            <div className="mt-1"><Badge>{inv.status}</Badge></div>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div><div className="label">Billed to</div><div className="font-semibold">{inv.customer}</div><div className="text-slate-500">WhatsApp {phone(inv.whatsapp_no)}</div>{inv.customer_gstin && <div className="text-slate-500">GSTIN {inv.customer_gstin}</div>}</div>
          <div className="text-right"><div className="label">Order</div><div>#{inv.order_id} · <span className="capitalize">{inv.order_status}</span></div><div className="text-slate-500">Billed by {inv.billed_by}</div></div>
        </section>
        <table className="table">
          <thead><tr><th>#</th><th>Item</th><th>HSN</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc.</th><th className="text-right">GST</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.line_no}>
                <td>{l.line_no}</td><td>{l.name}<div className="text-xs text-slate-400">{l.sku}</div></td><td>{l.hsn_code}</td>
                <td className="text-right">{Number(l.quantity)}</td><td className="text-right">{inr(l.unit_price)}</td>
                <td className="text-right">{l.discount ? inr(l.discount) : '—'}</td><td className="text-right">{l.gst_rate}%</td>
                <td className="text-right font-medium">{inr(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-5 w-72 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Taxable value</span><span>{inr(inv.taxable_value)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">CGST</span><span>{inr(inv.cgst)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">SGST</span><span>{inr(inv.sgst)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{inr(inv.total_amount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{inr(inv.amount_paid)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance</span><span className={balance > 0 ? 'text-red-600' : 'text-emerald-600'}>{inr(balance)}</span></div>
        </div>
      </article>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h3 className="mb-2 font-semibold">Payments</h3>
          {payments.length ? (
            <ul className="divide-y text-sm">
              {payments.map((p) => (
                <li key={p.payment_id} className="flex justify-between py-2"><span>{dt(p.paid_at)} · <span className="uppercase">{p.mode}</span>{p.reference_no ? ` · ${p.reference_no}` : ''}</span><b>{inr(p.amount)}</b></li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No payments yet</p>}
        </section>
        <section className="card no-print">
          <h3 className="mb-2 font-semibold">WhatsApp messages <span className="text-xs font-normal text-slate-400">(MongoDB log)</span></h3>
          {messages.length ? (
            <ul className="divide-y text-sm">
              {messages.map((m) => (
                <li key={String(m._id)} className="flex items-center justify-between py-2"><span>{dt(m.createdAt)} · {m.template}{m.simulated ? ' · demo' : ''}</span><Badge>{m.status}</Badge></li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">{db ? 'None yet' : 'MongoDB is not running'}</p>}
        </section>
      </div>

      {staff && balance > 0 && inv.status !== 'cancelled' && <PaymentForm invoiceId={inv.invoice_id} balance={balance} />}
    </div>
  );
}
