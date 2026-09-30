'use client';

import { useWishlist } from '@/lib/wishlist-store';
import { HeartIcon } from '@/components/ui/Icons';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  product: Product;
  className?: string;
  /** Show "Save" / "Saved" text next to the icon. */
  withLabel?: boolean;
}

export function WishlistButton({ product, className, withLabel = false }: WishlistButtonProps) {
  const { isWishlisted, toggleItem } = useWishlist();
  const active = isWishlisted(product.id);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleItem(product);
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors hover:text-persimmon',
        active ? 'text-persimmon' : 'text-ink',
        className,
      )}
    >
      <HeartIcon filled={active} />
      {withLabel ? (
        <span className="font-sans text-xs font-medium uppercase tracking-[0.14em]">{active ? 'Saved' : 'Save'}</span>
      ) : null}
    </button>
  );
}

export default WishlistButton;
