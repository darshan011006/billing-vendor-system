import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { tryMongo } from '@/lib/mongo';
import { inr, day, dt, phone } from '@/lib/format';
import { PageHeader, Badge, StatCard, Empty } from '@/components/ui';
import QuickForm from '@/components/QuickForm';

export default async function VendorLedgerPage({ params }) {
  const id = Number(params.id);
  const v = await one('SELECT v.*, fn_vendor_balance(v.vendor_id) AS balance FROM vendors v WHERE vendor_id = $1', [id]);
  if (!v) notFound();
  const [purchases, payments] = await Promise.all([
    q(`SELECT p.*, b.code AS branch FROM purchases p JOIN branches b USING (branch_id) WHERE vendor_id = $1 ORDER BY purchase_date DESC, purchase_id DESC`, [id]),
    q(`SELECT vp.*, p.vendor_invoice_no, u.full_name FROM vendor_payments vp LEFT JOIN purchases p USING (purchase_id) JOIN users u ON u.user_id = vp.paid_by WHERE vp.vendor_id = $1 ORDER BY vendor_payment_id DESC`, [id]),
  ]);
  const db = await tryMongo();
  const msgs = db ? await db.collection('notification_logs').find({ type: 'vendor_payment', to: v.whatsapp_no }).sort({ createdAt: -1 }).limit(10).toArray() : [];
  const unpaid = purchases.filter((p) => p.status !== 'paid');

  // running ledger: opening balance, then purchases (+) and payments (−) by date
  const entries = [
    ...purchases.map((p) => ({ date: p.purchase_date, key: `p${p.purchase_id}`, text: `Purchase ${p.vendor_invoice_no} (${p.branch})`, debit: p.total_amount, credit: 0 })),
    ...payments.map((p) => ({ date: p.payment_date, key: `v${p.vendor_payment_id}`, text: `Payment · ${p.mode.toUpperCase()}${p.reference_no ? ` ${p.reference_no}` : ''}${p.vendor_invoice_no ? ` for ${p.vendor_invoice_no}` : ''}`, debit: 0, credit: p.amount })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.key.localeCompare(b.key));
  let running = v.opening_balance;
  const ledger = entries.map((e) => ({ ...e, balance: (running += e.debit - e.credit) }));

  return (
    <>
      <PageHeader title={v.name} sub={`${v.contact_person || ''} · ${phone(v.whatsapp_no)}${v.gstin ? ` · GSTIN ${v.gstin}` : ''}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Balance due" value={inr(v.balance)} tone={v.balance > 0 ? 'bad' : 'good'} note="fn_vendor_balance()" />
        <StatCard label="Unpaid bills" value={unpaid.length} note={unpaid.map((p) => p.vendor_invoice_no).join(', ') || 'None'} />
        <StatCard label="Payments made" value={payments.length} note={inr(payments.reduce((s, p) => s + p.amount, 0))} />
      </div>

      {v.balance > 0 && (
        <QuickForm
          title="Record payment"
          endpoint={`/api/vendors/${id}/payments`}
          collapsed={false}
          columns={4}
          success="Payment saved. New balance {balance|inr}. Payment slip sent to the vendor on WhatsApp."
          fields={[
            { name: 'purchaseId', label: 'Against bill', placeholder: 'On account (no bill)', options: unpaid.map((p) => ({ value: p.purchase_id, label: `${p.vendor_invoice_no} · due ${inr(p.total_amount - p.paid_amount)}` })) },
            { name: 'amount', label: 'Amount ₹', type: 'number', required: true },
            { name: 'mode', label: 'Mode', default: 'neft', options: ['cash', 'upi', 'cheque', 'neft'].map((m) => ({ value: m, label: m.toUpperCase() })) },
            { name: 'referenceNo', label: 'UTR / cheque no.' },
          ]}
          submitLabel="Pay & send WhatsApp slip"
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="card p-0">
          <div className="px-5 pt-4 font-semibold">Ledger</div>
          <table className="table mt-2">
            <thead><tr><th>Date</th><th>Entry</th><th className="text-right">Bill (+)</th><th className="text-right">Paid (−)</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              <tr><td></td><td className="text-slate-500">Opening balance</td><td></td><td></td><td className="text-right">{inr(v.opening_balance)}</td></tr>
              {ledger.map((e) => (
                <tr key={e.key}><td>{day(e.date)}</td><td>{e.text}</td><td className="text-right">{e.debit ? inr(e.debit) : ''}</td><td className="text-right text-emerald-700">{e.credit ? inr(e.credit) : ''}</td><td className="text-right font-semibold">{inr(e.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
          <div className="card p-0">
            <div className="px-5 pt-4 font-semibold">Purchase bills</div>
            <table className="table mt-2"><tbody>
              {purchases.map((p) => <tr key={p.purchase_id}><td>{p.vendor_invoice_no}<div className="text-xs text-slate-400">{day(p.purchase_date)} · {p.branch}</div></td><td className="text-right">{inr(p.total_amount)}</td><td><Badge>{p.status}</Badge></td></tr>)}
            </tbody></table>
            {!purchases.length && <Empty>No purchases</Empty>}
          </div>
          <div className="card">
            <div className="mb-2 font-semibold">WhatsApp payment slips</div>
            {msgs.length ? msgs.map((m) => <div key={String(m._id)} className="flex justify-between border-t py-2 text-sm"><span>{dt(m.createdAt)} · {inr(m.payload?.amount)}</span><Badge>{m.status}</Badge></div>)
              : <p className="text-sm text-slate-400">{db ? 'None sent yet' : 'MongoDB is not running'}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
