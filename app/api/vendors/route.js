import { q, one } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { normalisePhone } from '@/lib/notify';

// GET /api/vendors — vendors with balance due (view v_vendor_outstanding)
export const GET = handler(async () => {
  await requireRole(['admin']);
  return Response.json(await q('SELECT * FROM v_vendor_outstanding ORDER BY balance_due DESC'));
});

// POST /api/vendors — add a vendor
export const POST = handler(async (req) => {
  await requireRole(['admin']);
  const b = await req.json();
  if (!String(b.name || '').trim()) throw new HttpError(400, 'Vendor name is required');
  const wa = normalisePhone(b.whatsapp);
  if (!wa) throw new HttpError(400, 'Enter the vendor\'s 10-digit WhatsApp number');
  const gstin = String(b.gstin || '').trim().toUpperCase();
  if (gstin && gstin.length !== 15) throw new HttpError(400, 'GSTIN must be 15 characters');
  const v = await one(
    `INSERT INTO vendors (name, gstin, contact_person, whatsapp_no, email, opening_balance)
     VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, NULLIF($5, ''), $6) RETURNING *`,
    [b.name.trim(), gstin, b.contactPerson || '', wa, b.email || '', Number(b.openingBalance || 0)],
  );
  return Response.json(v, { status: 201 });
});

export const dynamic = 'force-dynamic';
