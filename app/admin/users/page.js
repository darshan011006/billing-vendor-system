import { q } from '@/lib/db';
import { dt, phone } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import QuickForm from '@/components/QuickForm';

export default async function UsersPage() {
  const [users, branches] = await Promise.all([
    q(`SELECT u.*, b.code AS branch FROM users u LEFT JOIN branches b USING (branch_id) ORDER BY u.role, u.user_id`),
    q('SELECT branch_id, name FROM branches ORDER BY branch_id'),
  ]);
  return (
    <>
      <PageHeader title="Users" sub="Every login needs a WhatsApp number — the sign-in code is sent there" />
      <div className="mb-6">
        <QuickForm
          title="Add user"
          endpoint="/api/users"
          success='Created {role} login "{username}"'
          fields={[
            { name: 'fullName', label: 'Full name', required: true },
            { name: 'username', label: 'Username', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
            { name: 'role', label: 'Role', default: 'staff', options: [{ value: 'staff', label: 'Staff' }, { value: 'admin', label: 'Admin' }, { value: 'customer', label: 'Customer' }] },
            { name: 'branchId', label: 'Branch (staff/admin)', default: String(branches[0]?.branch_id || 1), options: branches.map((b) => ({ value: b.branch_id, label: b.name })) },
            { name: 'whatsapp', label: 'WhatsApp number', required: true, placeholder: '10-digit mobile' },
          ]}
        />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Branch</th><th>WhatsApp</th><th>Created</th><th>Active</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td className="font-mono">{u.username}</td><td>{u.full_name}</td><td><span className="capitalize">{u.role}</span></td><td>{u.branch || '—'}</td>
                <td>{phone(u.whatsapp_no)}</td><td>{dt(u.created_at)}</td><td>{u.is_active ? <span className="font-semibold text-emerald-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
