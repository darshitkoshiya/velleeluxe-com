'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const { isWishlisted, toggleItem } = useWishlist();
  const router = useRouter();
  const active = isWishlisted(product.id);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(`/account/login?redirect=/account/wishlist`);
      return;
    }
    toggleItem(product);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={user ? active : false}
      aria-label={active && user ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors hover:text-persimmon',
        active && user ? 'text-persimmon' : 'text-ink',
        className,
      )}
    >
      <HeartIcon filled={!!(active && user)} />
      {withLabel ? (
        <span className="font-sans text-xs font-medium uppercase tracking-[0.14em]">
          {active && user ? 'Saved' : 'Save'}
        </span>
      ) : null}
    </button>
  );
}

export default WishlistButton;
