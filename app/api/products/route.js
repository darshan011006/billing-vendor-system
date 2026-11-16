import { q, one } from '@/lib/db';
import { requireRole, handler, HttpError } from '@/lib/auth';
import { indexProduct } from '@/lib/vectors';

// GET /api/products?q=kum&branch=1 — product search with stock at the branch (billing screen)
export const GET = handler(async (req) => {
  const s = await requireRole(['admin', 'staff']);
  const url = new URL(req.url);
  const term = `%${(url.searchParams.get('q') || '').trim()}%`;
  const branch = Number(url.searchParams.get('branch')) || s.branchId;
  const rows = await q(
    `SELECT p.product_id, p.sku, p.barcode, p.name, p.gst_rate, p.selling_price, p.mrp, p.unit,
            COALESCE(st.quantity, 0) AS stock
       FROM products p
       LEFT JOIN stock st ON st.product_id = p.product_id AND st.branch_id = $2
      WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR p.barcode ILIKE $1
      ORDER BY p.name
      LIMIT 12`,
    [term, branch],
  );
  return Response.json(rows);
});

// POST /api/products — add a product (Admin)
export const POST = handler(async (req) => {
  await requireRole(['admin']);
  const b = await req.json();
  for (const f of ['name', 'sku', 'category', 'costPrice', 'sellingPrice', 'mrp']) {
    if (b[f] === undefined || b[f] === '') throw new HttpError(400, `${f} is required`);
  }
  // existing category, or a new one placed under an optional parent (category tree)
  const cat = await one(
    `INSERT INTO categories (name, parent_id) VALUES ($1, (SELECT category_id FROM categories WHERE name = NULLIF($2, '')))
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING category_id`,
    [String(b.category).trim(), String(b.parentCategory || '').trim()],
  );
  const p = await one(
    `INSERT INTO products (category_id, sku, barcode, name, hsn_code, gst_rate, unit, cost_price, selling_price, mrp, low_stock_threshold)
     VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, $7, $8, $9, $10, $11) RETURNING *`,
    [cat.category_id, b.sku.trim().toUpperCase(), b.barcode || '', b.name.trim(), b.hsnCode || '', Number(b.gstRate || 0), b.unit || 'pcs',
     Number(b.costPrice), Number(b.sellingPrice), Number(b.mrp), Number(b.lowStockThreshold || 5)],
  );
  await indexProduct(p.product_id).catch(() => false); // add its embedding to MongoDB product_vectors
  return Response.json(p, { status: 201 });
});

export const dynamic = 'force-dynamic';
