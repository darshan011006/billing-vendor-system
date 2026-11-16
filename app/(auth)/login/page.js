'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    try { sessionStorage.setItem('otp_hint', JSON.stringify({ to: data.to, devOtp: data.devOtp || null })); } catch {}
    router.push('/verify-otp');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <Logo />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">Step 1 of 2 · a code is then sent to your WhatsApp</p>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" className="input mb-4" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input mb-4" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy || !form.username || !form.password}>{busy ? 'Checking…' : 'Continue'}</button>
        <p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          Demo logins: <b>admin</b> / admin123 · <b>staff</b> / staff123 · <b>anita</b> / customer123
        </p>
      </form>
    </main>
  );
}
