// Small presentational pieces shared by pages
export function StatCard({ label, value, note, tone = 'default' }) {
  const color = { default: 'text-slate-900', good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600' }[tone];
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </div>
  );
}

const BADGE = {
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  read: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
  packed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  queued: 'bg-slate-100 text-slate-600 ring-slate-200',
  pending: 'bg-slate-100 text-slate-600 ring-slate-200',
  unpaid: 'bg-red-50 text-red-700 ring-red-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  open: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200 line-through',
};

export function Badge({ children }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${BADGE[children] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{children}</span>;
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="no-print flex gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="px-3 py-8 text-center text-sm text-slate-400">{children}</div>;
}
