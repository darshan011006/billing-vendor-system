'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inr } from '@/lib/format';

export function PrintButton() {
  return <button className="btn-ghost" onClick={() => window.print()}>Print</button>;
}

export function ResendButton({ invoiceId }) {
  const [state, setState] = useState('');
  async function send() {
    setState('Sending…');
    const res = await fetch(`/api/invoices/${invoiceId}/resend`, { method: 'POST' });
    const d = await res.json();
    setState(res.ok ? (d.simulated ? 'Sent (demo mode)' : 'Sent on WhatsApp') : d.error || 'Failed');
  }
  return <button className="btn-ghost" onClick={send}>{state || 'Send on WhatsApp'}</button>;
}

export function PaymentForm({ invoiceId, balance }) {
  const router = useRouter();
  const [form, setForm] = useState({ amount: balance.toFixed(2), mode: 'upi', referenceNo: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, ...form }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="no-print card space-y-3">
      <h3 className="font-semibold">Record payment · {inr(balance)} due</h3>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Amount</label><input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div><label className="label">Mode</label>
          <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            {['cash', 'upi', 'card', 'bank'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
        </div>
        <div><label className="label">Reference</label><input className="input" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
    </form>
  );
}
