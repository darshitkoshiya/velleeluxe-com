'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn, titleCase } from '@/lib/utils';

export type FilterKey = 'fit' | 'colour' | 'style';

export interface FilterOptions {
  fit: string[];
  colour: string[];
  style: string[];
}

interface ProductFiltersProps {
  options: FilterOptions;
}

const GROUPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'fit', label: 'Fit' },
  { key: 'colour', label: 'Colour' },
  { key: 'style', label: 'Style' },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 whitespace-nowrap rounded-sm border px-4 font-sans text-xs transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        active ? 'border-ink bg-ink text-linen' : 'border-sand bg-transparent text-ink hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Filter pills. The selection lives in the URL (?fit=relaxed&colour=white) so it can be shared. */
export function ProductFilters({ options }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = (key: FilterKey, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const hasAnyFilter = GROUPS.some(({ key }) => searchParams.get(key));

  return (
    <div className="space-y-4" aria-label="Filter products" role="region">
      {GROUPS.map(({ key, label }) => {
        const values = options[key];
        if (values.length === 0) return null;
        const current = searchParams.get(key);
        return (
          <div key={key} className="flex items-center gap-4">
            <span className="label-caps w-14 shrink-0 text-oxford">{label}</span>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              <Pill active={!current} onClick={() => setFilter(key, null)}>
                All
              </Pill>
              {values.map((value) => (
                <Pill key={value} active={current === value} onClick={() => setFilter(key, current === value ? null : value)}>
                  {titleCase(value)}
                </Pill>
              ))}
            </div>
          </div>
        );
      })}
      {hasAnyFilter ? (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="font-sans text-xs text-slateGrey underline underline-offset-4 hover:text-persimmon"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}

export default ProductFilters;
