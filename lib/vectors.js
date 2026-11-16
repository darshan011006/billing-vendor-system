// Product embeddings in MongoDB (collection product_vectors) and similarity search.
import { Int32 } from 'mongodb';
import { tryMongo } from '@/lib/mongo';
import { q } from '@/lib/db';
import { embed, productText, similarityPipeline, MODEL } from '@/db/mongo/embedding';

const PRODUCTS_WITH_PATH = `
  WITH RECURSIVE tree AS (
      SELECT category_id, name::text AS path FROM categories WHERE parent_id IS NULL
      UNION ALL SELECT c.category_id, t.path || ' > ' || c.name FROM categories c JOIN tree t ON c.parent_id = t.category_id)
  SELECT p.product_id, p.sku, p.name, p.hsn_code, tree.path AS category_path
    FROM products p LEFT JOIN tree USING (category_id)`;

async function upsert(col, p) {
  const text = productText(p);
  await col.updateOne(
    { productId: new Int32(p.product_id) },
    { $set: { sku: p.sku, name: p.name, category: p.category_path, text, embedding: embed(text), model: MODEL, updatedAt: new Date() } },
    { upsert: true },
  );
}

// Called after a product is added (best effort: billing never depends on it)
export async function indexProduct(productId) {
  const db = await tryMongo();
  if (!db) return false;
  const [p] = await q(`${PRODUCTS_WITH_PATH} WHERE p.product_id = $1`, [productId]);
  if (p) await upsert(db.collection('product_vectors'), p);
  return true;
}

export async function rebuildAll() {
  const db = await tryMongo();
  if (!db) throw new Error('MongoDB is not running');
  const col = db.collection('product_vectors');
  const products = await q(PRODUCTS_WITH_PATH);
  for (const p of products) await upsert(col, p);
  const ids = products.map((p) => new Int32(p.product_id));
  const { deletedCount } = await col.deleteMany({ productId: { $nin: ids } });
  return { indexed: products.length, removed: deletedCount };
}

export async function similarProducts(text, limit = 5) {
  const db = await tryMongo();
  if (!db) throw new Error('MongoDB is not running');
  return db.collection('product_vectors').aggregate(similarityPipeline(embed(text), limit)).toArray();
}
