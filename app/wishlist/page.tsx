'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLoginPrompt } from '@/lib/login-prompt-store';
import { useWishlist } from '@/lib/wishlist-store';
import { ProductCard } from '@/components/product/ProductCard';
import { buttonClasses } from '@/components/ui/Button';
import { HeartIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const openLoginPrompt = useLoginPrompt((s) => s.open);
  const { items, removeItem, clearWishlist, loading } = useWishlist();

  useEffect(() => {
    if (!authLoading && !user) openLoginPrompt();
  }, [authLoading, user, openLoginPrompt]);

  if (authLoading) return <PageLoader label="Loading wishlist" />;

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-sand pb-8">
          <div>
            <p className="label-caps text-oxford">Saved for later</p>
            <h1 className="mt-3 font-sans text-3xl font-medium text-ink">Wishlist</h1>
            {!loading && items.length > 0 ? (
              <p className="mt-2 font-sans text-sm text-ink-muted">
                {items.length} {items.length === 1 ? 'item' : 'items'} saved on this device
              </p>
            ) : null}
          </div>
          {!loading && items.length > 0 ? (
            <button
              type="button"
              onClick={clearWishlist}
              className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted underline underline-offset-4 hover:text-accent"
            >
              Clear all
            </button>
          ) : null}
        </header>

        <div className="mt-10">
          {loading ? (
            <PageLoader label="Loading your wishlist" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-sand text-ink-muted">
                <HeartIcon width={28} height={28} />
              </span>
              <p className="mt-6 font-serif text-2xl italic text-ink">Your wishlist is empty</p>
              <p className="mt-2 font-sans text-sm text-ink-muted">Tap the heart on any product to save it here.</p>
              <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
                Start Shopping
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14">
              {items.map((product, index) => (
                <li key={product.id} className="flex flex-col">
                  <ProductCard product={product} priority={index < 4} />
                  <button
                    type="button"
                    onClick={() => removeItem(product.id)}
                    aria-label={`Remove ${product.name} from wishlist`}
                    className="mt-3 self-start font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted underline underline-offset-4 hover:text-accent"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
