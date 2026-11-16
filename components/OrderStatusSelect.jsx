'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NEXT = { pending: ['confirmed', 'cancelled'], confirmed: ['packed', 'delivered', 'cancelled'], packed: ['delivered', 'cancelled'], delivered: [], cancelled: [] };

export default function OrderStatusSelect({ orderId, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const options = NEXT[status] || [];
  if (!options.length) return <span className="text-xs text-slate-400">—</span>;

  async function change(e) {
    const to = e.target.value;
    if (!to) return;
    if (to === 'cancelled' && !confirm('Cancel this order? Stock goes back and the invoice is cancelled.')) return (e.target.value = '');
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: to }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) alert(data.error);
    router.refresh();
  }

  return (
    <select className="input w-36 py-1 text-xs" disabled={busy} defaultValue="" onChange={change}>
      <option value="">Move to…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
