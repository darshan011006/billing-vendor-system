import { q } from '@/lib/db';
import { inr, num } from '@/lib/format';
import { PageHeader, Badge } from '@/components/ui';
import QuickForm from '@/components/QuickForm';
import VectorSearch from '@/components/VectorSearch';
import { tryMongo } from '@/lib/mongo';

export default async function ProductsPage() {
  const [products, categories, tree] = await Promise.all([
    q(`SELECT p.*, c.name AS category, COALESCE(SUM(s.quantity), 0) AS stock,
              BOOL_OR(s.quantity <= p.low_stock_threshold) AS any_low
         FROM products p LEFT JOIN categories c USING (category_id) LEFT JOIN stock s USING (product_id)
        GROUP BY p.product_id, c.name ORDER BY c.name, p.name`),
    q('SELECT name FROM categories ORDER BY name'),
    // recursive CTE: walk the self-referencing category tree from the roots down
    q(`WITH RECURSIVE tree AS (
          SELECT category_id, name, 1 AS level, name::text AS path FROM categories WHERE parent_id IS NULL
          UNION ALL
          SELECT c.category_id, c.name, t.level + 1, t.path || ' > ' || c.name FROM categories c JOIN tree t ON c.parent_id = t.category_id)
        SELECT tree.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = tree.category_id) AS products
          FROM tree ORDER BY path`),
  ]);
  const db = await tryMongo();
  const vectorCount = db ? await db.collection('product_vectors').countDocuments() : null;
  return (
    <>
      <PageHeader title="Products" sub={`${products.length} products · prices include GST`} />
      <div className="mb-6">
        <QuickForm
          title="Add product"
          endpoint="/api/products"
          success="Added {name} ({sku}). Receive stock through a purchase."
          columns={4}
          fields={[
            { name: 'name', label: 'Name', required: true, wide: true },
            { name: 'sku', label: 'SKU', required: true },
            { name: 'barcode', label: 'Barcode' },
            { name: 'category', label: 'Category', required: true, list: categories.map((c) => c.name) },
            { name: 'parentCategory', label: 'Parent (if new category)', placeholder: 'None', options: categories.map((c) => ({ value: c.name, label: c.name })) },
            { name: 'hsnCode', label: 'HSN code' },
            { name: 'gstRate', label: 'GST %', default: '18', options: [0, 5, 12, 18, 28].map((r) => ({ value: r, label: `${r}%` })) },
            { name: 'unit', label: 'Unit', default: 'pcs' },
            { name: 'costPrice', label: 'Cost price ₹', type: 'number', required: true },
            { name: 'sellingPrice', label: 'Selling price ₹', type: 'number', required: true },
            { name: 'mrp', label: 'MRP ₹', type: 'number', required: true },
            { name: 'lowStockThreshold', label: 'Low-stock alert at', type: 'number', default: '5' },
          ]}
        />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>HSN</th><th>GST</th><th className="text-right">Cost</th><th className="text-right">Price</th><th className="text-right">MRP</th><th className="text-right">Stock (all branches)</th><th>Alert at</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product_id}>
                <td className="font-mono text-xs">{p.sku}</td><td className="font-medium text-slate-900">{p.name}</td><td>{p.category}</td><td>{p.hsn_code}</td><td>{p.gst_rate}%</td>
                <td className="text-right">{inr(p.cost_price)}</td><td className="text-right">{inr(p.selling_price)}</td><td className="text-right">{inr(p.mrp)}</td>
                <td className="text-right">{num(p.stock)} {p.unit} {p.any_low && <Badge>open</Badge>}</td><td>{p.low_stock_threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="card h-fit">
          <h2 className="font-semibold">Category tree</h2>
          <p className="mb-3 text-xs text-slate-500">categories.parent_id → categories · read with a recursive CTE</p>
          <ul className="space-y-1 text-sm">
            {tree.map((t) => (
              <li key={t.category_id} style={{ paddingLeft: `${(t.level - 1) * 18}px` }} className="flex justify-between">
                <span>{t.level > 1 ? '└ ' : ''}<span className={t.level === 1 ? 'font-semibold' : ''}>{t.name}</span></span>
                <span className="text-xs text-slate-400">{t.products} products</span>
              </li>
            ))}
          </ul>
        </section>
        {vectorCount === null ? <div className="card text-sm text-slate-500">MongoDB is not running, so vector search is unavailable.</div> : <VectorSearch canRebuild count={vectorCount} />}
      </div>
    </>
  );
}
