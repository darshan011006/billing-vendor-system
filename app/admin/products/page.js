import { q } from '@/lib/db';
import { inr, num } from '@/lib/format';
import { PageHeader, Badge } from '@/components/ui';
import QuickForm from '@/components/QuickForm';

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    q(`SELECT p.*, c.name AS category, COALESCE(SUM(s.quantity), 0) AS stock,
              BOOL_OR(s.quantity <= p.low_stock_threshold) AS any_low
         FROM products p LEFT JOIN categories c USING (category_id) LEFT JOIN stock s USING (product_id)
        GROUP BY p.product_id, c.name ORDER BY c.name, p.name`),
    q('SELECT name FROM categories ORDER BY name'),
  ]);
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
    </>
  );
}
