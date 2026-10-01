import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ShopView } from '@/components/product/ShopView';
import { buildColourVariantMap, getBestSellerIds, getCatalog } from '@/lib/catalog';

export const revalidate = 10800;

export const metadata: Metadata = {
  title: 'Shop',
  description: "Shop premium men's shirts — oxford, linen and poplin in tailored, relaxed and oversized fits.",
  alternates: { canonical: '/shop' },
};

export default async function ShopPage() {
  // Falls back to placeholder products when the sheet is empty or unavailable.
  const { products, isMock } = await getCatalog();
  const bestSellerIds = isMock ? getBestSellerIds() : [];
  const colourVariantMap = buildColourVariantMap(products);

  return (
    <div className="container-page py-12 md:py-16">
      <header className="mb-10 md:mb-12">
        <p className="label-caps text-oxford">The Collection</p>
        <h1 className="mt-3 font-sans text-3xl font-medium text-ink md:text-4xl">The Collection</h1>
        <p className="mt-3 max-w-xl font-serif text-lg text-slateGrey">
          Considered cloth, clean construction, and fits for every build.
        </p>
      </header>

      {/* Filters read the URL, so they render inside Suspense; the fallback shows the full grid. */}
      <Suspense
        fallback={
          <ProductGrid
            products={products}
            priorityCount={4}
            bestSellerIds={bestSellerIds}
            colourVariantMap={colourVariantMap}
          />
        }
      >
        <ShopView products={products} bestSellerIds={bestSellerIds} colourVariantMap={colourVariantMap} />
      </Suspense>
    </div>
  );
}
