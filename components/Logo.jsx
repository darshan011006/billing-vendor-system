export default function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white shadow-md ring-2 ring-white/30">B</div>
      <div>
        <div className={`text-base font-bold leading-tight ${light ? 'text-white' : 'text-slate-900'}`}>BillDesk</div>
        <div className={`text-xs ${light ? 'text-brand-100' : 'text-slate-500'}`}>Billing &amp; Vendor Management</div>
      </div>
    </div>
  );
}
