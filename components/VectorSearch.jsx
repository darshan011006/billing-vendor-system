'use client';
// Vector similarity search over MongoDB product_vectors
import { useState } from 'react';

export default function VectorSearch({ canRebuild = false, count }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/products/similar?q=${encodeURIComponent(text)}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(d.error);
    setRows(d);
  }

  async function rebuild() {
    setMsg('Re-embedding…');
    const res = await fetch('/api/products/vectors', { method: 'POST' });
    const d = await res.json();
    setMsg(res.ok ? `Embedded ${d.indexed} products${d.removed ? `, removed ${d.removed} stale` : ''}` : d.error);
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold">Find similar products <span className="text-xs font-normal text-slate-400">MongoDB vector search</span></h2>
          <p className="text-xs text-slate-500">Your words become a 256-number vector and are compared with {count ?? 'each'} product vectors by cosine similarity — it tolerates typos and partial words.</p>
        </div>
        {canRebuild && <button type="button" className="btn-ghost" onClick={rebuild}>Rebuild vectors</button>}
      </div>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <input className="input" placeholder='Try "diya lamp", "kalsh", "dhoop incence", "ghee"' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      {rows && (
        <table className="table mt-3">
          <thead><tr><th>Product</th><th>Category path</th><th>SKU</th><th className="w-48">Similarity</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId}>
                <td className="font-medium text-slate-900">{r.name}</td><td className="text-xs">{r.category}</td><td className="font-mono text-xs">{r.sku}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-brand-500" style={{ width: `${Math.max(4, r.score * 100)}%` }} /></div>
                    <span className="w-10 text-right font-mono text-xs">{r.score.toFixed(2)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No similar products</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  );
}
