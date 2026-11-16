import Link from 'next/link';
import { tryMongo } from '@/lib/mongo';
import { dt, phone } from '@/lib/format';
import { PageHeader, Badge, StatCard, Empty } from '@/components/ui';
import { previewText, isDemoMode } from '@/lib/whatsapp';
import { RowActions, PurgeButton } from '@/components/NotificationActions';

const TYPES = ['all', 'bill', 'order_status', 'vendor_payment', 'otp', 'low_stock'];

export default async function NotificationsPage({ searchParams }) {
  const db = await tryMongo();
  if (!db) {
    return (
      <>
        <PageHeader title="WhatsApp Log" sub="MongoDB · notification_logs" />
        <div className="card text-sm text-slate-600">MongoDB is not running, so there is no log to show. Restart with <code>npm run dev</code>.</div>
      </>
    );
  }
  const type = TYPES.includes(searchParams.type) && searchParams.type !== 'all' ? searchParams.type : null;
  const logs = db.collection('notification_logs');
  const [rows, summary] = await Promise.all([
    logs.find(type ? { type } : {}).sort({ createdAt: -1 }).limit(150).toArray(),
    logs.aggregate([
      { $group: { _id: '$type', total: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]).toArray(),
  ]);
  const collections = await Promise.all(
    ['notification_logs', 'otp_sessions', 'product_vectors'].map(async (name) => {
      const col = db.collection(name);
      const [count, indexes, info] = await Promise.all([col.countDocuments(), col.indexes(), db.listCollections({ name }).next()]);
      return { name, count, indexes: indexes.map((i) => `${Object.entries(i.key).map(([k, v]) => `${k}:${v}`).join(', ')}${i.unique ? ' unique' : ''}${i.expireAfterSeconds !== undefined ? ` TTL ${i.expireAfterSeconds}s` : ''}${i.partialFilterExpression ? ' partial' : ''}${i.sparse ? ' sparse' : ''}`), validated: !!info?.options?.validator };
    }),
  );
  const total = summary.reduce((s, x) => s + x.total, 0);
  const failed = summary.reduce((s, x) => s + x.failed, 0);

  return (
    <>
      <PageHeader title="WhatsApp Log" sub={`MongoDB collection notification_logs · ${isDemoMode() ? 'demo mode: messages are printed in the terminal, not sent' : 'live WhatsApp Cloud API'}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Messages" value={total} />
        <StatCard label="Failed" value={failed} tone={failed ? 'bad' : 'good'} note={total ? `${((failed / total) * 100).toFixed(1)}% failure rate` : ''} />
        {summary.slice(0, 2).map((s) => <StatCard key={s._id} label={s._id.replace('_', ' ')} value={s.total} note="by $group aggregation" />)}
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {collections.map((c) => (
          <div key={c.name} className="card">
            <div className="flex items-baseline justify-between"><span className="font-mono text-sm font-semibold">{c.name}</span><span className="text-sm text-slate-500">{c.count} docs</span></div>
            <div className="mt-1 text-xs text-slate-500">{c.validated ? '$jsonSchema validator on' : 'no validator'}</div>
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-600">{c.indexes.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link key={t} href={`/admin/notifications${t === 'all' ? '' : `?type=${t}`}`} className={`rounded-full px-3 py-1 text-sm font-medium ${(type || 'all') === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{t.replace('_', ' ')}</Link>
        ))}
      </div>
      <PurgeButton />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Time</th><th>Type</th><th>To</th><th>Message</th><th>Linked row</th><th>Tries</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={String(m._id)}>
                <td className="whitespace-nowrap">{dt(m.createdAt)}</td>
                <td><span className="font-mono text-xs">{m.type}</span></td>
                <td className="whitespace-nowrap">{phone(m.to)}</td>
                <td className="max-w-md text-xs text-slate-600">{m.type === 'otp' ? 'Login code (not stored)' : previewText(m.template, m.payload || {})}{m.error && <div className="text-red-600">{m.error.message}</div>}</td>
                <td className="font-mono text-xs">{m.ref ? `${m.ref.table}#${m.ref.id}` : ''}</td>
                <td>{m.attempts}</td>
                <td><Badge>{m.status}</Badge>{m.simulated && <div className="mt-1 text-[10px] uppercase text-slate-400">demo</div>}</td>
                <td><RowActions id={String(m._id)} status={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No messages yet — make a bill or pay a vendor</Empty>}
      </div>
    </>
  );
}
