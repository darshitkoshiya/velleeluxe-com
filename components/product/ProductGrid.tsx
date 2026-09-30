import type { ReactNode } from 'react';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  /** Shown when the list is empty. */
  emptyState?: ReactNode;
  /** Number of leading cards to load eagerly. */
  priorityCount?: number;
  className?: string;
}

export function ProductGrid({ products, emptyState, priorityCount = 0, className }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-20 text-center">
        {emptyState ?? <p className="font-serif text-lg italic text-slateGrey">No shirts to show right now.</p>}
      </div>
    );
  }

  return (
    <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14', className)}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export default ProductGrid;
