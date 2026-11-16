'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inr } from '@/lib/format';

const blank = { productId: '', quantity: '', unitCost: '' };

export default function PurchaseForm({ vendors, branches, products }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ vendorId: '', branchId: branches[0]?.branch_id || '', vendorInvoiceNo: '', purchaseDate: '' });
  const [items, setItems] = useState([{ ...blank }]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const pmap = Object.fromEntries(products.map((p) => [p.product_id, p]));

  const set = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, it) => {
    const p = pmap[it.productId];
    return s + (p ? Number(it.quantity || 0) * Number(it.unitCost || 0) * (1 + p.gst_rate / 100) : 0);
  }, 0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...head, items }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ error: d.error });
    setMsg({ ok: `Saved purchase ${d.vendor_invoice_no} for ${inr(d.total_amount)}. Stock added by trigger trg_purchase_item.` });
    setItems([{ ...blank }]);
    setHead({ ...head, vendorInvoiceNo: '' });
    router.refresh();
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ New purchase</button>;

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="flex justify-between"><h2 className="font-semibold">New purchase (vendor bill)</h2><button type="button" className="text-sm text-slate-500" onClick={() => setOpen(false)}>Close</button></div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div><label className="label">Vendor *</label><select className="input" value={head.vendorId} onChange={(e) => setHead({ ...head, vendorId: e.target.value })}><option value="">Choose…</option>{vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}</select></div>
        <div><label className="label">Receiving branch *</label><select className="input" value={head.branchId} onChange={(e) => setHead({ ...head, branchId: e.target.value })}>{branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}</select></div>
        <div><label className="label">Vendor invoice no. *</label><input className="input" value={head.vendorInvoiceNo} onChange={(e) => setHead({ ...head, vendorInvoiceNo: e.target.value })} /></div>
        <div><label className="label">Bill date</label><input type="date" className="input" value={head.purchaseDate} onChange={(e) => setHead({ ...head, purchaseDate: e.target.value })} /></div>
      </div>
      <table className="table">
        <thead><tr><th>Product</th><th className="w-28">Qty</th><th className="w-36">Unit cost ₹ (ex-GST)</th><th>GST</th><th className="text-right">Line total</th><th></th></tr></thead>
        <tbody>
          {items.map((it, i) => {
            const p = pmap[it.productId];
            return (
              <tr key={i}>
                <td><select className="input" value={it.productId} onChange={(e) => set(i, { productId: e.target.value, unitCost: pmap[e.target.value]?.cost_price ?? '' })}><option value="">Choose product…</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}</select></td>
                <td><input type="number" min="1" className="input" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></td>
                <td><input type="number" step="0.01" className="input" value={it.unitCost} onChange={(e) => set(i, { unitCost: e.target.value })} /></td>
                <td>{p ? `${p.gst_rate}%` : ''}</td>
                <td className="text-right">{p ? inr(Number(it.quantity || 0) * Number(it.unitCost || 0) * (1 + p.gst_rate / 100)) : ''}</td>
                <td>{items.length > 1 && <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={() => setItems([...items, { ...blank }])}>+ Add line</button>
        <div className="text-lg font-bold">Total {inr(total)}</div>
      </div>
      {msg?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      {msg?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg.ok}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save purchase & add stock'}</button>
    </form>
  );
}
