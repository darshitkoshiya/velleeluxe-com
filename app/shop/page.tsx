import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ShopView } from '@/components/product/ShopView';
import { getProducts } from '@/lib/sheets';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Shop',
  description: "Shop premium men's shirts — oxford, linen and poplin in tailored, relaxed and oversized fits.",
  alternates: { canonical: '/shop' },
};

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <div className="container-page py-12 md:py-16">
      <header className="mb-10 md:mb-12">
        <p className="label-caps text-oxford">The Collection</p>
        <h1 className="mt-3 font-sans text-3xl font-medium text-ink md:text-4xl">Shirts</h1>
        <p className="mt-3 max-w-xl font-serif text-lg text-slateGrey">
          Considered cloth, clean construction, and fits for every build.
        </p>
      </header>

      {/* Filters read the URL, so they render inside Suspense; the fallback shows the full grid. */}
      <Suspense fallback={<ProductGrid products={products} priorityCount={4} />}>
        <ShopView products={products} />
      </Suspense>
    </div>
  );
}
