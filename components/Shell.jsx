import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function Shell({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className="min-h-screen">
      <Sidebar session={session} />
      <main className="print-full ml-60 px-8 py-7">{children}</main>
    </div>
  );
}
