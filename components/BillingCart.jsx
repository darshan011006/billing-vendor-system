'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { inr } from '@/lib/format';

export default function BillingCart({ branches, defaultBranch, isAdmin }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(defaultBranch);
  const [customer, setCustomer] = useState({ customerId: null, name: '', phone: '' });
  const [custHits, setCustHits] = useState([]);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState([]);
  const [lines, setLines] = useState([]);
  const [mode, setMode] = useState('cash');
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef(null);

  // product search
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!term.trim()) return setHits([]);
      const r = await fetch(`/api/products?q=${encodeURIComponent(term)}&branch=${branchId}`);
      setHits(r.ok ? await r.json() : []);
    }, 200);
    return () => clearTimeout(t);
  }, [term, branchId]);

  // saved-customer lookup by phone / name
  useEffect(() => {
    if (customer.customerId) return;
    const key = customer.phone.length >= 4 ? customer.phone : customer.name.length >= 2 ? customer.name : '';
    const t = setTimeout(async () => {
      if (!key) return setCustHits([]);
      const r = await fetch(`/api/customers?q=${encodeURIComponent(key)}`);
      setCustHits(r.ok ? await r.json() : []);
    }, 250);
    return () => clearTimeout(t);
  }, [customer]);

  function add(p) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.product_id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { productId: p.product_id, name: p.name, sku: p.sku, price: p.selling_price, gst: p.gst_rate, stock: p.stock, quantity: 1, discount: 0 }];
    });
    setTerm('');
    setHits([]);
    searchRef.current?.focus();
  }

  const update = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = useMemo(() => lines.reduce((s, l) => s + Math.max(0, l.quantity * l.price - (Number(l.discount) || 0)), 0), [lines]);
  const gst = useMemo(() => lines.reduce((s, l) => { const t = Math.max(0, l.quantity * l.price - (Number(l.discount) || 0)); return s + (t - t / (1 + l.gst / 100)); }, 0), [lines]);

  useEffect(() => { setReceived(total ? total.toFixed(2) : ''); }, [total]);

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        customer: customer.customerId ? { customerId: customer.customerId } : { name: customer.name, phone: customer.phone },
        items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), discount: Number(l.discount) || 0 })),
        payment: { mode, amount: Number(received) || 0, referenceNo: reference },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.push(`/invoices/${data.invoiceId}?new=1`);
  }

  const over = lines.filter((l) => l.quantity > l.stock);
  const canSubmit = lines.length && (customer.customerId || (customer.name.trim() && customer.phone.replace(/\D/g, '').length >= 10)) && !over.length && !busy;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Customer</h2>
            {isAdmin && (
              <select className="input w-auto" value={branchId} onChange={(e) => { setBranchId(Number(e.target.value)); setLines([]); }}>
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            )}
          </div>
          {customer.customerId ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
              <div><div className="font-semibold">{customer.name}</div><div className="text-sm text-slate-500">+{customer.phone}</div></div>
              <button className="btn-ghost" onClick={() => setCustomer({ customerId: null, name: '', phone: '' })}>Change</button>
            </div>
          ) : (
            <div className="relative grid gap-4 sm:grid-cols-2">
              <div><label className="label">Customer name *</label><input className="input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Required for every bill" /></div>
              <div><label className="label">WhatsApp number *</label><input className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/[^\d+ ]/g, '') })} placeholder="10-digit mobile" /></div>
              {custHits.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs text-slate-500">Saved customers — click to use:</div>
                  <div className="flex flex-wrap gap-2">
                    {custHits.map((c) => (
                      <button key={c.customer_id} className="btn-ghost" onClick={() => { setCustomer({ customerId: c.customer_id, name: c.name, phone: c.whatsapp_no }); setCustHits([]); }}>
                        {c.name} · {c.whatsapp_no.slice(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Items</h2>
          <div className="relative">
            <input ref={searchRef} className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search product name, SKU or scan barcode…"
              onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); add(hits[0]); } }} />
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {hits.map((p) => (
                  <button key={p.product_id} onClick={() => add(p)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-brand-50">
                    <span><b>{p.name}</b> <span className="text-slate-400">{p.sku}</span></span>
                    <span className="text-slate-500">{inr(p.selling_price)} · <span className={p.stock > 0 ? '' : 'text-red-600'}>stock {p.stock}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <table className="table mt-4">
            <thead><tr><th>#</th><th>Product</th><th className="w-24">Qty</th><th>Price</th><th className="w-28">Discount ₹</th><th>GST</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.productId}>
                  <td>{i + 1}</td>
                  <td><div className="font-medium text-slate-900">{l.name}</div><div className={`text-xs ${l.quantity > l.stock ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{l.sku} · in stock {l.stock}</div></td>
                  <td><input type="number" min="1" className="input py-1" value={l.quantity} onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value)) })} /></td>
                  <td>{inr(l.price)}</td>
                  <td><input type="number" min="0" className="input py-1" value={l.discount} onChange={(e) => update(i, { discount: e.target.value })} /></td>
                  <td>{l.gst}%</td>
                  <td className="text-right font-semibold">{inr(Math.max(0, l.quantity * l.price - (Number(l.discount) || 0)))}</td>
                  <td><button className="text-xs font-semibold text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan={8} className="py-10 text-center text-slate-400">Cart is empty — search a product to begin</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <aside className="card h-fit space-y-4 xl:sticky xl:top-6">
        <h2 className="font-semibold">Checkout</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Taxable value</span><span>{inr(total - gst)}</span></div>
          <div className="flex justify-between text-slate-500"><span>GST (CGST + SGST)</span><span>{inr(gst)}</span></div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{inr(total)}</span></div>
        </div>
        <div>
          <label className="label">Payment mode</label>
          <div className="grid grid-cols-4 gap-2">
            {['cash', 'upi', 'card', 'bank'].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-lg border px-2 py-2 text-sm font-semibold uppercase ${mode === m ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div><label className="label">Amount received now</label><input type="number" className="input" value={received} onChange={(e) => setReceived(e.target.value)} /><p className="mt-1 text-xs text-slate-500">Less than the total leaves the bill partly paid; 0 = credit.</p></div>
        {mode !== 'cash' && <div><label className="label">Reference / UTR</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>}
        {over.length > 0 && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Not enough stock for {over.map((l) => l.name).join(', ')}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn w-full py-3 text-base" disabled={!canSubmit} onClick={submit}>{busy ? 'Saving…' : `Complete bill · ${inr(total)}`}</button>
        <p className="text-center text-xs text-slate-400">The bill is sent to the customer on WhatsApp.</p>
      </aside>
    </div>
  );
}
