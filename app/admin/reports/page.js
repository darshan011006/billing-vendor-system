// Runs every query in db/postgres/04_queries.sql live and shows the SQL next to its result.
import fs from 'node:fs';
import path from 'node:path';
import { q } from '@/lib/db';
import { PageHeader } from '@/components/ui';

function loadQueries() {
  const text = fs.readFileSync(path.join(process.cwd(), 'db', 'postgres', '04_queries.sql'), 'utf8');
  const sections = [];
  let section = null;
  let cur = null;
  for (const line of text.split('\n')) {
    const sec = line.match(/^-- -{3,} (.+?) -{3,}\s*$/);
    const head = line.match(/^-- (Q\d+) (.+)$/);
    if (sec) {
      section = { title: sec[1], queries: [] };
      sections.push(section);
      cur = null;
    } else if (head && section) {
      cur = { id: head[1], title: head[2], sql: [] };
      section.queries.push(cur);
    } else if (cur && !line.startsWith('-- ====')) {
      cur.sql.push(line);
    }
  }
  for (const s of sections) for (const c of s.queries) c.sql = c.sql.join('\n').trim().replace(/;\s*$/, '');
  return sections;
}

const show = (v) => {
  if (v === null || v === undefined) return <span className="text-slate-300">null</span>;
  if (v instanceof Date) return v.toLocaleDateString('en-IN');
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return String(v);
};

export default async function ReportsPage() {
  const sections = loadQueries();
  for (const s of sections) {
    await Promise.all(
      s.queries.map(async (c) => {
        try { c.rows = await q(c.sql); } catch (err) { c.error = err.message; }
      }),
    );
  }
  const count = sections.reduce((n, s) => n + s.queries.length, 0);

  return (
    <>
      <PageHeader title="SQL Reports" sub={`${count} queries from db/postgres/04_queries.sql, run live against PostgreSQL as your database role`} />
      <nav className="no-print mb-6 flex flex-wrap gap-2">
        {sections.map((s) => <a key={s.title} href={`#${s.title.replace(/\W+/g, '-')}`} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50">{s.title}</a>)}
      </nav>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title} id={s.title.replace(/\W+/g, '-')}>
            <h2 className="mb-3 text-lg font-bold text-slate-900">{s.title}</h2>
            <div className="space-y-4">
              {s.queries.map((c) => {
                const cols = c.rows?.length ? Object.keys(c.rows[0]) : [];
                return (
                  <article key={c.id} className="card p-0">
                    <div className="flex items-baseline gap-3 px-5 pt-4">
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">{c.id}</span>
                      <h3 className="font-semibold">{c.title}</h3>
                      <span className="ml-auto text-xs text-slate-400">{c.error ? 'error' : `${c.rows.length} rows`}</span>
                    </div>
                    <details className="px-5 pt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-600">Show SQL</summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">{c.sql}</pre>
                    </details>
                    {c.error ? (
                      <p className="m-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{c.error}</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="table">
                          <thead><tr>{cols.map((k) => <th key={k}>{k}</th>)}</tr></thead>
                          <tbody>
                            {c.rows.slice(0, 20).map((r, i) => <tr key={i}>{cols.map((k) => <td key={k}>{show(r[k])}</td>)}</tr>)}
                          </tbody>
                        </table>
                        {!c.rows.length && <p className="px-5 py-4 text-sm text-slate-400">No rows</p>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
