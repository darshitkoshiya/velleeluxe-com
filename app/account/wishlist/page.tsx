'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductGrid } from '@/components/product/ProductGrid';
import { buttonClasses } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Product } from '@/lib/types';

export default function WishlistPage() {
  const { user } = useAuth();
  const { wishlist, loading } = useWishlist();
  const [catalogue, setCatalogue] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products')
      .then((response) => {
        if (!response.ok) throw new Error('Request failed');
        return response.json() as Promise<Product[]>;
      })
      .then((products) => {
        if (!cancelled) setCatalogue(products);
      })
      .catch(() => {
        if (!cancelled) setError('We could not load your wishlist. Please refresh the page.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(
    () => (catalogue ?? []).filter((product) => wishlist.includes(product.id)),
    [catalogue, wishlist],
  );

  return (
    <div className="container-page py-12 md:py-16">
      <header className="border-b border-sand pb-8">
        <p className="label-caps text-oxford">Saved for later</p>
        <h1 className="mt-3 font-sans text-3xl font-medium text-ink">Wishlist</h1>
        {!user ? (
          <p className="mt-3 font-serif text-base text-slateGrey">
            Saved on this device.{' '}
            <Link href="/account/login?redirect=/account/wishlist" className="text-persimmon underline underline-offset-4">
              Sign in
            </Link>{' '}
            to keep your wishlist across devices.
          </p>
        ) : null}
      </header>

      <div className="mt-10">
        {error ? (
          <p role="alert" className="font-sans text-sm text-persimmon">
            {error}
          </p>
        ) : loading || catalogue === null ? (
          <PageLoader label="Loading your wishlist" />
        ) : (
          <ProductGrid
            products={products}
            emptyState={
              <div>
                <p className="font-serif text-2xl italic text-ink">Nothing saved yet.</p>
                <p className="mt-2 font-serif text-lg text-slateGrey">Tap the heart on any shirt to save it here.</p>
                <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
                  Browse Shirts
                </Link>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
