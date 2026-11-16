'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

const NAV = {
  admin: [
    ['Overview', null],
    ['/admin/dashboard', 'Dashboard'],
    ['Sales', null],
    ['/staff/billing', 'New Bill'],
    ['/staff/orders', 'Orders'],
    ['/staff/invoices', 'Invoices'],
    ['Inventory', null],
    ['/admin/products', 'Products'],
    ['/admin/stock', 'Stock & Alerts'],
    ['Vendors', null],
    ['/admin/vendors', 'Vendors'],
    ['/admin/purchases', 'Purchases'],
    ['System', null],
    ['/admin/notifications', 'WhatsApp Log'],
    ['/admin/users', 'Users'],
  ],
  staff: [
    ['/staff/dashboard', 'Dashboard'],
    ['/staff/billing', 'New Bill'],
    ['/staff/orders', 'Orders'],
    ['/staff/invoices', 'Invoices'],
  ],
  customer: [['/customer/dashboard', 'My Orders & Bills']],
};

export default function Sidebar({ session }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="no-print fixed inset-y-0 left-0 flex w-60 flex-col bg-brand-900 px-3 py-5 text-sm">
      <div className="px-2"><Logo light /></div>
      <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
        {(NAV[session.role] || []).map(([href, label]) =>
          label === null ? (
            <div key={href} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-100/60">{href}</div>
          ) : (
            <Link key={href} href={href} className={`block rounded-lg px-3 py-2 font-medium ${path.startsWith(href) ? 'bg-white text-brand-900' : 'text-brand-50 hover:bg-white/10'}`}>
              {label}
            </Link>
          ),
        )}
      </nav>
      <div className="border-t border-white/10 px-2 pt-4 text-brand-100">
        <div className="font-semibold text-white">{session.name}</div>
        <div className="text-xs capitalize">{session.role}{session.branchName ? ` · ${session.branchName}` : ''}</div>
        <button onClick={logout} className="mt-3 text-xs font-semibold text-white/80 hover:text-white">Sign out →</button>
      </div>
    </aside>
  );
}
