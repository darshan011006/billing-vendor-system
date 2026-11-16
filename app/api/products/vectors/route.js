// POST /api/products/vectors — re-embed every product into MongoDB product_vectors (Admin)
import { requireRole, handler } from '@/lib/auth';
import { rebuildAll } from '@/lib/vectors';

export const POST = handler(async () => {
  await requireRole(['admin']);
  return Response.json(await rebuildAll());
});

export const dynamic = 'force-dynamic';
