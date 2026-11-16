// GET /api/products/similar?q=diya%20lamp — vector similarity search over product_vectors (MongoDB)
import { requireRole, handler, HttpError } from '@/lib/auth';
import { similarProducts } from '@/lib/vectors';

export const GET = handler(async (req) => {
  await requireRole(['admin', 'staff']);
  const text = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!text) throw new HttpError(400, 'Type something to search for');
  const rows = await similarProducts(text, 6);
  return Response.json(rows.map((r) => ({ productId: r.productId, sku: r.sku, name: r.name, category: r.category, score: Math.round(r.score * 1000) / 1000 })));
});

export const dynamic = 'force-dynamic';
