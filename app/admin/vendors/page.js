import Link from 'next/link';
import { q } from '@/lib/db';
import { inr, phone } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import QuickForm from '@/components/QuickForm';

export default async function VendorsPage() {
  const vendors = await q(
    `SELECT v.*, o.open_bills, o.balance_due,
            (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE vendor_id = v.vendor_id) AS purchased,
            (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments WHERE vendor_id = v.vendor_id) AS paid
       FROM vendors v JOIN v_vendor_outstanding o USING (vendor_id) ORDER BY o.balance_due DESC`,
  );
  const total = vendors.reduce((s, v) => s + v.balance_due, 0);
  return (
    <>
      <PageHeader title="Vendors" sub={`${inr(total)} owed to ${vendors.filter((v) => v.balance_due > 0).length} vendors · balance = opening + purchases − payments (fn_vendor_balance)`} />
      <div className="mb-6">
        <QuickForm
          title="Add vendor"
          endpoint="/api/vendors"
          success="Added {name}"
          fields={[
            { name: 'name', label: 'Vendor name', required: true },
            { name: 'contactPerson', label: 'Contact person' },
            { name: 'whatsapp', label: 'WhatsApp number', required: true, placeholder: '10-digit mobile' },
            { name: 'gstin', label: 'GSTIN' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'openingBalance', label: 'Opening balance ₹', type: 'number', default: '0' },
          ]}
        />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Vendor</th><th>Contact</th><th>GSTIN</th><th className="text-right">Opening</th><th className="text-right">Purchased</th><th className="text-right">Paid</th><th className="text-right">Balance due</th><th>Open bills</th><th></th></tr></thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.vendor_id}>
                <td className="font-semibold text-slate-900">{v.name}</td>
                <td>{v.contact_person}<div className="text-xs text-slate-400">{phone(v.whatsapp_no)}</div></td>
                <td className="font-mono text-xs">{v.gstin || '—'}</td>
                <td className="text-right">{inr(v.opening_balance)}</td><td className="text-right">{inr(v.purchased)}</td><td className="text-right">{inr(v.paid)}</td>
                <td className={`text-right font-bold ${v.balance_due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(v.balance_due)}</td>
                <td>{v.open_bills}</td>
                <td><Link href={`/admin/vendors/${v.vendor_id}`} className="btn-ghost">Ledger &amp; pay</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
