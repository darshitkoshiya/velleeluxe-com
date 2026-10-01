'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useFreeShippingThreshold, useShippingFee } from '@/hooks/useFreeShippingThreshold';
import { CartItem } from '@/components/cart/CartItem';
import { buttonClasses } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { calculateShipping, formatPrice } from '@/lib/utils';

export default function CartPage() {
  const { items, subtotal, totalItems, hydrated } = useCart();
  const freeShippingThreshold = useFreeShippingThreshold();
  const shippingFee = useShippingFee();

  if (!hydrated) return <PageLoader label="Loading your cart" />;

  if (items.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <h1 className="font-serif text-3xl italic text-ink">Your cart is empty</h1>
        <p className="mt-3 font-serif text-lg text-slateGrey">Find something you&rsquo;ll reach for every week.</p>
        <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-10' })}>
          Shop Now
        </Link>
      </div>
    );
  }

  const shipping = calculateShipping(subtotal, freeShippingThreshold, shippingFee);
  const remaining = freeShippingThreshold - subtotal;

  return (
    <div className="container-page py-12 md:py-16">
      <h1 className="font-sans text-3xl font-medium text-ink">
        Cart <span className="text-slateGrey">({totalItems})</span>
      </h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <section aria-label="Items in your cart">
          <ul className="border-t border-sand">
            {items.map((item) => (
              <CartItem key={`${item.product.id}-${item.size}`} item={item} variant="large" />
            ))}
          </ul>
          <Link
            href="/shop"
            className="mt-6 inline-block font-sans text-xs font-medium uppercase tracking-[0.14em] text-ink underline-offset-4 hover:text-persimmon hover:underline"
          >
            &larr; Continue Shopping
          </Link>
        </section>

        <aside aria-labelledby="summary-title" className="h-fit border border-sand p-6 lg:sticky lg:top-24">
          <h2 id="summary-title" className="label-caps text-ink">
            Order Summary
          </h2>
          <dl className="mt-6 space-y-3 font-sans text-sm">
            <div className="flex justify-between">
              <dt className="text-slateGrey">Subtotal</dt>
              <dd className="text-ink">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slateGrey">Shipping</dt>
              <dd className="text-ink">{shipping === 0 ? 'Free' : formatPrice(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-sand pt-3 text-base font-medium">
              <dt>Estimated total</dt>
              <dd>{formatPrice(subtotal + shipping)}</dd>
            </div>
          </dl>
          <p className="mt-3 font-serif text-sm italic text-slateGrey">
            {remaining > 0
              ? `Add ${formatPrice(remaining)} more for free shipping. Final shipping is confirmed at checkout.`
              : 'Your order qualifies for free shipping.'}
          </p>
          <Link href="/checkout" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'full', className: 'mt-6' })}>
            Proceed to Checkout
          </Link>
        </aside>
      </div>
    </div>
  );
}
