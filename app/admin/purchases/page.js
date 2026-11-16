import Link from 'next/link';
import { q } from '@/lib/db';
import { inr, day } from '@/lib/format';
import { PageHeader, Badge } from '@/components/ui';
import PurchaseForm from '@/components/PurchaseForm';

export default async function PurchasesPage() {
  const [rows, vendors, branches, products] = await Promise.all([
    q(`SELECT p.*, v.name AS vendor, b.code AS branch,
              (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.purchase_id) AS lines
         FROM purchases p JOIN vendors v USING (vendor_id) JOIN branches b USING (branch_id)
        ORDER BY p.purchase_date DESC, p.purchase_id DESC`),
    q('SELECT vendor_id, name FROM vendors ORDER BY name'),
    q('SELECT branch_id, name FROM branches ORDER BY branch_id'),
    q('SELECT product_id, sku, name, gst_rate, cost_price FROM products ORDER BY name'),
  ]);
  return (
    <>
      <PageHeader title="Purchases" sub={`${rows.length} vendor bills · ${inr(rows.reduce((s, r) => s + r.total_amount - r.paid_amount, 0))} unpaid`} />
      <div className="mb-6"><PurchaseForm vendors={vendors} branches={branches} products={products} /></div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Date</th><th>Vendor invoice</th><th>Vendor</th><th>Branch</th><th>Lines</th><th className="text-right">Total (incl. GST)</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.purchase_id}>
                <td>{day(r.purchase_date)}</td><td className="font-medium">{r.vendor_invoice_no}</td>
                <td><Link href={`/admin/vendors/${r.vendor_id}`} className="text-brand-600 hover:underline">{r.vendor}</Link></td>
                <td>{r.branch}</td><td>{r.lines}</td>
                <td className="text-right font-semibold">{inr(r.total_amount)}</td><td className="text-right">{inr(r.paid_amount)}</td><td><Badge>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
