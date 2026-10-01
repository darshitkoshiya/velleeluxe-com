import type { ReactNode } from 'react';
import type { ColourVariant, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  /** Shown when the list is empty. */
  emptyState?: ReactNode;
  /** Number of leading cards to load eagerly. */
  priorityCount?: number;
  className?: string;
  /** Product IDs that get the "Best Seller" badge. */
  bestSellerIds?: string[];
  /** Product ID → colour variants of its design (only designs with 2+ colours). */
  colourVariantMap?: Record<string, ColourVariant[]>;
}

export function ProductGrid({
  products,
  emptyState,
  priorityCount = 0,
  className,
  bestSellerIds = [],
  colourVariantMap,
}: ProductGridProps) {
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
          <ProductCard
            product={product}
            priority={index < priorityCount}
            bestSeller={bestSellerIds.includes(product.id)}
            colourVariants={colourVariantMap?.[product.id]}
          />
        </li>
      ))}
    </ul>
  );
}

export default ProductGrid;
