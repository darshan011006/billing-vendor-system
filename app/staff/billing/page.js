import { q } from '@/lib/db';
import { getSession } from '@/lib/auth';
import BillingCart from '@/components/BillingCart';
import { PageHeader } from '@/components/ui';

export default async function BillingPage() {
  const s = await getSession();
  const branches = await q('SELECT branch_id, name FROM branches ORDER BY branch_id');
  return (
    <>
      <PageHeader title="New Bill" sub={`Billing at ${branches.find((b) => b.branch_id === s.branchId)?.name || 'your branch'} · prices include GST`} />
      <BillingCart branches={branches} defaultBranch={s.branchId} isAdmin={s.role === 'admin'} />
    </>
  );
}
