import { getProducts } from '@/lib/sheets';
import { buildAdminProducts, getManualProducts, getProductOverrides } from '@/lib/product-overrides';
import ProductsTable from '@/components/admin/ProductsTable';
import type { AdminProduct } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  let products: AdminProduct[] = [];
  let error: string | null = null;
  try {
    const [sheetProducts, overrides, manual] = await Promise.all([
      getProducts(),
      getProductOverrides(),
      getManualProducts(),
    ]);
    products = buildAdminProducts(sheetProducts, overrides, manual);
  } catch (err) {
    console.error('[admin/products] Failed to load products:', err);
    error = 'Could not load products. Check the Firebase and Google Sheets configuration.';
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          margin: '0 0 24px',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Products</h1>
        <a
          href="/admin/products/new"
          style={{
            background: '#1C2230',
            color: '#F6F1E8',
            borderRadius: '6px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          + Add Product
        </a>
      </div>
      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : (
        <ProductsTable products={products} />
      )}
    </div>
  );
}
