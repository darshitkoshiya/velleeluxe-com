'use client';

import { useWishlist } from '@/hooks/useWishlist';
import { HeartIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: string;
  productName: string;
  className?: string;
  /** Show "Save" / "Saved" text next to the icon. */
  withLabel?: boolean;
}

export function WishlistButton({ productId, productName, className, withLabel = false }: WishlistButtonProps) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle(productId);
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
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
