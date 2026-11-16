'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [hint, setHint] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setHint(JSON.parse(sessionStorage.getItem('otp_hint') || '{}')); } catch {}
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    try { sessionStorage.removeItem('otp_hint'); } catch {}
    router.replace(data.redirect);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <Logo />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">Enter the WhatsApp code</h1>
        <p className="mb-6 text-sm text-slate-500">Step 2 of 2 · sent to {hint.to ? `+${hint.to.slice(0, 2)} ••••• ${hint.to.slice(-4)}` : 'your WhatsApp'}</p>
        {hint.devOtp && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Demo mode (no WhatsApp API key set): your code is <b className="font-mono tracking-widest">{hint.devOtp}</b>
          </p>
        )}
        <label className="label" htmlFor="code">6-digit code</label>
        <input id="code" className="input mb-4 text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify & sign in'}</button>
        <button type="button" onClick={() => router.push('/login')} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-700">Back to sign in</button>
      </form>
    </main>
  );
}
