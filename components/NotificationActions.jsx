'use client';
// Update / delete actions on MongoDB notification_logs documents
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RowActions({ id, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function call(method, body) {
    setBusy(true);
    const res = await fetch(`/api/notifications/${id}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) alert((await res.json()).error);
    router.refresh();
  }
  return (
    <div className="flex gap-1">
      {['queued', 'sent'].includes(status) && (
        <button disabled={busy} className="whitespace-nowrap rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => call('PATCH', { status: 'delivered' })} title="updateOne: $set status, $push history">
          Mark delivered
        </button>
      )}
      {status === 'delivered' && (
        <button disabled={busy} className="whitespace-nowrap rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => call('PATCH', { status: 'read' })}>
          Mark read
        </button>
      )}
      <button disabled={busy} className="whitespace-nowrap rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50" onClick={() => confirm('Delete this log entry?') && call('DELETE')} title="deleteOne">
        Delete
      </button>
    </div>
  );
}

export function PurgeButton() {
  const router = useRouter();
  const [days, setDays] = useState('30');
  const [msg, setMsg] = useState('');
  async function purge() {
    const res = await fetch(`/api/notifications?olderThanDays=${days}`, { method: 'DELETE' });
    const d = await res.json();
    setMsg(res.ok ? `Deleted ${d.deleted}` : d.error);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Delete delivered/read/failed older than</span>
      <input className="input w-16 py-1" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
      <span className="text-slate-500">days</span>
      <button className="btn-ghost" onClick={purge} title="deleteMany">Purge</button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
