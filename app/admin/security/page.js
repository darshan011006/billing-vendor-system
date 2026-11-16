// Shows the role-based access control that PostgreSQL itself enforces (db/postgres/05_dcl.sql),
// read live from the system catalogs, and proves it by running test statements as each role.
import { q, one, tryAs } from '@/lib/db';
import { PageHeader } from '@/components/ui';

const ROLES = ['erp_admin', 'erp_staff', 'erp_customer', 'erp_auth'];
const SHORT = { SELECT: 'S', INSERT: 'I', UPDATE: 'U', DELETE: 'D', TRUNCATE: 'T', REFERENCES: 'R', TRIGGER: 'G' };

export default async function SecurityPage() {
  const [tableGrants, columnGrants, policies, routines, rlsTables] = await Promise.all([
    q(`SELECT c.relname AS tbl, a.grantee::regrole::text AS role, a.privilege_type AS priv
         FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v') AND a.grantee <> 0`),
    q(`SELECT c.relname AS tbl, a.grantee::regrole::text AS role, a.privilege_type AS priv, string_agg(att.attname, ', ' ORDER BY att.attnum) AS cols
         FROM pg_attribute att JOIN pg_class c ON c.oid = att.attrelid CROSS JOIN LATERAL aclexplode(att.attacl) a
        WHERE c.relnamespace = 'public'::regnamespace AND att.attacl IS NOT NULL AND a.grantee <> 0
        GROUP BY 1, 2, 3`),
    q(`SELECT tablename, policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`),
    q(`SELECT p.proname AS name, CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind, p.prosecdef AS definer,
              COALESCE((SELECT string_agg(a.grantee::regrole::text, ', ') FROM aclexplode(p.proacl) a WHERE a.grantee <> 0), '') AS execute_by
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY kind DESC, name`),
    q(`SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity ORDER BY relname`),
  ]);

  const tables = [...new Set([...tableGrants.map((g) => g.tbl), ...columnGrants.map((g) => g.tbl)])].sort();
  const cell = (tbl, role) => {
    const t = tableGrants.filter((g) => g.tbl === tbl && g.role === role).map((g) => SHORT[g.priv] || g.priv);
    const c = columnGrants.filter((g) => g.tbl === tbl && g.role === role).map((g) => `${SHORT[g.priv]}(${g.cols})`);
    const all = t.length >= 7 ? ['ALL'] : t.sort();
    return [...all, ...c].join(' ');
  };

  const anita = await one(`SELECT c.customer_id FROM customers c JOIN users u ON u.user_id = c.user_id WHERE u.username = 'anita'`);
  const totalInvoices = (await one('SELECT COUNT(*)::int AS n FROM invoices')).n;
  const tests = [
    ['bv_app (no role)', null, null, 'SELECT COUNT(*) FROM public.products', 'The app login has no table rights of its own'],
    ['erp_staff', 'erp_staff', null, 'SELECT COUNT(*) FROM invoices', 'Staff can see all bills'],
    ['erp_staff', 'erp_staff', null, 'SELECT name FROM vendors LIMIT 1', 'Staff cannot see vendors'],
    ['erp_staff', 'erp_staff', null, 'SELECT password_hash FROM users LIMIT 1', 'Staff cannot read password hashes'],
    ['erp_staff', 'erp_staff', null, "CALL sp_record_vendor_payment(1, NULL, 1, 'cash', NULL, 2)", 'Staff cannot pay vendors'],
    ['erp_customer (anita)', 'erp_customer', anita?.customer_id, 'SELECT COUNT(*) FROM invoices', `Row-level security: ${totalInvoices} invoices exist`],
    ['erp_customer (anita)', 'erp_customer', anita?.customer_id, "UPDATE invoices SET status = 'paid'", 'Customers are read-only'],
    ['erp_auth', 'erp_auth', null, 'SELECT COUNT(*) FROM orders', 'Before sign-in only the login lookup works'],
    ['erp_admin', 'erp_admin', null, 'SELECT COUNT(*) FROM vendors', 'Admin can see everything'],
  ];
  const results = await Promise.all(tests.map(([, role, cid, sql]) => tryAs(role, cid, sql)));

  return (
    <>
      <PageHeader title="Database Security" sub="Role-based access control enforced by PostgreSQL (db/postgres/05_dcl.sql) — read live from the system catalogs" />

      <section className="card mb-6">
        <h2 className="font-semibold">How a request reaches the data</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>The app connects as <code>bv_app</code>, a login with <b>no table rights</b> (NOINHERIT).</li>
          <li>Each request runs <code>SET LOCAL ROLE erp_admin | erp_staff | erp_customer | erp_auth</code> from the signed-in user, plus <code>app.customer_id</code>.</li>
          <li>PostgreSQL checks GRANTs and row-level-security policies for that role, so access holds even if app code were wrong.</li>
          <li>Business routines are <code>SECURITY DEFINER</code>: staff can bill (which writes invoices and stock) without direct write access to those tables.</li>
        </ol>
      </section>

      <section className="card mb-6 p-0">
        <div className="px-5 pt-4 font-semibold">Live test: the same statements run as each role</div>
        <p className="px-5 text-xs text-slate-500">Each test runs in its own transaction and is rolled back.</p>
        <table className="table mt-2">
          <thead><tr><th>Role</th><th>Statement</th><th>What it shows</th><th>PostgreSQL said</th></tr></thead>
          <tbody>
            {tests.map(([label, , , sql, why], i) => {
              const r = results[i];
              return (
                <tr key={i}>
                  <td className="whitespace-nowrap font-mono text-xs">{label}</td>
                  <td className="font-mono text-xs">{sql}</td>
                  <td className="text-xs">{why}</td>
                  <td className="text-xs">
                    {r.ok ? <span className="font-semibold text-emerald-700">✓ allowed{r.rows?.[0]?.count !== undefined ? ` · count = ${r.rows[0].count}` : ''}</span>
                      : <span className="font-semibold text-red-600">✗ {r.error}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card mb-6 p-0">
        <div className="px-5 pt-4 font-semibold">Privileges per role</div>
        <p className="px-5 text-xs text-slate-500">S select · I insert · U update · D delete · S(cols) = only those columns. Row-level security on: {rlsTables.map((t) => t.relname).join(', ')}</p>
        <div className="overflow-x-auto">
          <table className="table mt-2">
            <thead><tr><th>Table / view</th>{ROLES.map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t}>
                  <td className="font-mono text-xs font-semibold">{t}{rlsTables.some((x) => x.relname === t) && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">RLS</span>}</td>
                  {ROLES.map((r) => <td key={r} className="font-mono text-xs">{cell(t, r) || <span className="text-slate-300">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6">
        <section className="card p-0">
          <div className="px-5 pt-4 font-semibold">Row-level security policies</div>
          <table className="table mt-2">
            <thead><tr><th>Table</th><th>Policy</th><th>For</th><th>Roles</th><th>Rows visible when</th></tr></thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.tablename + p.policyname}>
                  <td className="font-mono text-xs">{p.tablename}</td><td className="font-mono text-xs">{p.policyname}</td><td className="text-xs">{p.cmd}</td>
                  <td className="font-mono text-xs">{p.roles.replace(/[{}]/g, '')}</td><td className="font-mono text-[11px]">{p.qual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card p-0">
          <div className="px-5 pt-4 font-semibold">Functions, procedures and trigger functions</div>
          <table className="table mt-2">
            <thead><tr><th>Name</th><th>Kind</th><th>Runs as</th><th>EXECUTE granted to</th></tr></thead>
            <tbody>
              {routines.map((r) => (
                <tr key={r.name}>
                  <td className="font-mono text-xs">{r.name}</td><td className="text-xs">{r.kind}</td>
                  <td className="text-xs">{r.definer ? 'owner (SECURITY DEFINER)' : 'caller'}</td>
                  <td className="font-mono text-[11px]">{r.execute_by || <span className="text-slate-300">owner only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
