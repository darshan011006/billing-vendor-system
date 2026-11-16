'use client';
// A small form that POSTs its fields as JSON and refreshes the page on success.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inr } from '@/lib/format';

// success text may contain {field} or {field|inr} placeholders filled from the API response
const fill = (text, data) => text.replace(/\{(\w+)(\|inr)?\}/g, (_, k, f) => (f ? inr(data?.[k]) : data?.[k] ?? ''));

export default function QuickForm({ title, endpoint, fields, submitLabel = 'Save', columns = 3, collapsed = true, success = 'Saved' }) {
  const router = useRouter();
  const initial = Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']));
  const [open, setOpen] = useState(!collapsed);
  const [values, setValues] = useState(initial);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ error: data.error || 'Something went wrong' });
    setValues(initial);
    setMsg({ ok: fill(success, data) });
    router.refresh();
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ {title}</button>;

  return (
    <form onSubmit={submit} className="card mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {collapsed && <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => setOpen(false)}>Close</button>}
      </div>
      <div className={`grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {fields.map((f) => (
          <div key={f.name} className={f.wide ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor={f.name}>{f.label}{f.required ? ' *' : ''}</label>
            {f.options ? (
              <select id={f.name} className="input" value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                {f.placeholder !== undefined && <option value="">{f.placeholder}</option>}
                {f.options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input id={f.name} className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} list={f.list ? `${f.name}-list` : undefined}
                placeholder={f.placeholder} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            )}
            {f.list && <datalist id={`${f.name}-list`}>{f.list.map((x) => <option key={x} value={x} />)}</datalist>}
          </div>
        ))}
      </div>
      {msg?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      {msg?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg.ok}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
}
