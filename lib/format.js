export const inr = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const dt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export const phone = (p) => (p && p.length === 12 ? `+${p.slice(0, 2)} ${p.slice(2, 7)} ${p.slice(7)}` : p || '');
