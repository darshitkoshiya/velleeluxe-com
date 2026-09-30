'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { Product } from '@/lib/types';
import { ProductFilters, type FilterOptions } from './ProductFilters';
import { ProductGrid } from './ProductGrid';

const STANDARD_FITS = ['tailored', 'relaxed', 'oversized'];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

/** Client-side filtering of the (server-fetched) product list using URL params. */
export function ShopView({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const fit = searchParams.get('fit');
  const colour = searchParams.get('colour');
  const style = searchParams.get('style');

  const options = useMemo<FilterOptions>(() => {
    const extraFits = unique(products.map((p) => p.fit)).filter((f) => !STANDARD_FITS.includes(f));
    return {
      fit: [...STANDARD_FITS, ...extraFits],
      colour: unique(products.map((p) => p.colour)),
      style: unique(products.map((p) => p.style)),
    };
  }, [products]);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => (!fit || p.fit === fit) && (!colour || p.colour === colour) && (!style || p.style === style),
      ),
    [products, fit, colour, style],
  );

  return (
    <>
      <div className="border-b border-sand pb-8">
        <ProductFilters options={options} />
      </div>
      <p className="py-6 font-sans text-xs uppercase tracking-[0.14em] text-slateGrey" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'shirt' : 'shirts'}
      </p>
      <ProductGrid
        products={filtered}
        priorityCount={4}
        emptyState={
          products.length === 0 ? (
            <div>
              <p className="font-serif text-xl italic text-ink">The new collection is on its way.</p>
              <p className="mt-2 font-serif text-slateGrey">Check back soon.</p>
            </div>
          ) : (
            <div>
              <p className="font-serif text-xl italic text-ink">No shirts match these filters.</p>
              <Link href="/shop" className="mt-4 inline-block font-sans text-xs uppercase tracking-[0.14em] text-persimmon underline underline-offset-4">
                Clear filters
              </Link>
            </div>
          )
        }
      />
    </>
  );
}

export default ShopView;
