'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ColourVariant, Product } from '@/lib/types';
import { cn, titleCase } from '@/lib/utils';
import { CloseIcon, PlusIcon, MinusIcon } from '@/components/ui/Icons';
import { ProductFilters, type FilterKey, type FilterOptions } from './ProductFilters';
import { ProductGrid } from './ProductGrid';

const STANDARD_FITS = ['tailored', 'relaxed', 'oversized'];
const FILTER_KEYS: FilterKey[] = ['fit', 'colour', 'style'];
const FILTER_LABELS: Record<FilterKey, string> = { fit: 'Fit', colour: 'Colour', style: 'Fabric' };

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function isSortKey(value: string | null): value is SortKey {
  return SORT_OPTIONS.some((o) => o.value === value);
}

function sortProducts(products: Product[], sort: SortKey): Product[] {
  if (sort === 'featured') return products;
  const list = [...products];
  if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  if (sort === 'newest') list.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return list;
}

interface ShopViewProps {
  products: Product[];
  /** Product IDs that get the "Best Seller" badge. */
  bestSellerIds?: string[];
  /** Product ID → colour variants of its design (only designs with 2+ colours). */
  colourVariantMap?: Record<string, ColourVariant[]>;
}

/** Client-side filtering and sorting of the (server-fetched) product list using URL params. */
export function ShopView({ products, bestSellerIds = [], colourVariantMap }: ShopViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const active = {
    fit: searchParams.get('fit'),
    colour: searchParams.get('colour'),
    style: searchParams.get('style'),
  };
  const rawSort = searchParams.get('sort');
  const sort: SortKey = isSortKey(rawSort) ? rawSort : 'featured';

  const options = useMemo<FilterOptions>(() => {
    const extraFits = unique(products.map((p) => p.fit)).filter((f) => !STANDARD_FITS.includes(f));
    return {
      fit: [...STANDARD_FITS, ...extraFits],
      colour: unique(products.map((p) => p.colour)),
      style: unique(products.map((p) => p.style)),
    };
  }, [products]);

  const visible = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        (!active.fit || p.fit === active.fit) &&
        (!active.colour || p.colour === active.colour) &&
        (!active.style || p.style === active.style),
    );
    return sortProducts(filtered, sort);
  }, [products, active.fit, active.colour, active.style, sort]);

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const activeChips = FILTER_KEYS.flatMap((key) => {
    const value = active[key];
    return value ? [{ key, value }] : [];
  });

  const clearFilters = () => updateParams((params) => FILTER_KEYS.forEach((key) => params.delete(key)));

  return (
    <>
      {/* Toolbar: filter toggle (mobile), count, sort */}
      <div className="flex items-center justify-between gap-4 border-y border-sand py-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          className="inline-flex h-10 items-center gap-2 font-sans text-xs font-medium uppercase tracking-[0.14em] text-ink hover:text-persimmon md:hidden"
        >
          {filtersOpen ? <MinusIcon width={14} height={14} /> : <PlusIcon width={14} height={14} />}
          Filter
          {activeChips.length > 0 ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink px-1 text-[10px] text-linen">
              {activeChips.length}
            </span>
          ) : null}
        </button>

        <p className="hidden font-sans text-xs uppercase tracking-[0.14em] text-slateGrey md:block" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'shirt' : 'shirts'}
          {visible.length !== products.length ? <span className="text-pebble"> of {products.length}</span> : null}
        </p>

        <label className="flex items-center gap-2 font-sans text-xs text-slateGrey">
          <span className="hidden uppercase tracking-[0.14em] sm:inline">Sort by</span>
          <span className="sr-only sm:hidden">Sort by</span>
          <select
            value={sort}
            onChange={(event) =>
              updateParams((params) => {
                const value = event.target.value;
                if (value === 'featured') params.delete('sort');
                else params.set('sort', value);
              })
            }
            className="h-10 cursor-pointer rounded-sm border border-sand bg-linen pl-3 pr-8 font-sans text-xs text-ink focus:border-ink focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div id="shop-filters" className={cn('border-b border-sand py-6', filtersOpen ? 'block' : 'hidden md:block')}>
        <ProductFilters options={options} labels={FILTER_LABELS} />
      </div>

      <div className="flex flex-wrap items-center gap-2 py-5">
        <p className="mr-2 font-sans text-xs uppercase tracking-[0.14em] text-slateGrey md:hidden" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'shirt' : 'shirts'}
        </p>
        {activeChips.map(({ key, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => updateParams((params) => params.delete(key))}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-ink bg-ink pl-3 pr-2 font-sans text-xs text-linen transition-colors hover:border-persimmon hover:bg-persimmon"
            aria-label={`Remove filter ${FILTER_LABELS[key]}: ${titleCase(value)}`}
          >
            <span>
              <span className="text-linen/70">{FILTER_LABELS[key]}:</span> {titleCase(value)}
            </span>
            <CloseIcon width={14} height={14} />
          </button>
        ))}
        {activeChips.length > 1 ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-sans text-xs text-slateGrey underline underline-offset-4 hover:text-persimmon"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <ProductGrid
        products={visible}
        priorityCount={4}
        bestSellerIds={bestSellerIds}
        colourVariantMap={colourVariantMap}
        emptyState={
          products.length === 0 ? (
            <div>
              <p className="font-serif text-xl italic text-ink">The new collection is on its way.</p>
              <p className="mt-2 font-serif text-slateGrey">Check back soon.</p>
            </div>
          ) : (
            <div>
              <p className="font-serif text-xl italic text-ink">No shirts match these filters.</p>
              <Link
                href="/shop"
                className="mt-4 inline-block font-sans text-xs uppercase tracking-[0.14em] text-persimmon underline underline-offset-4"
              >
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
