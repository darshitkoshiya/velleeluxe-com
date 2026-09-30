'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCart } from '@/hooks/useCart';
import { useOverlay } from '@/hooks/useOverlay';
import { Button, buttonClasses } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/Icons';
import { formatPrice, FREE_SHIPPING_THRESHOLD } from '@/lib/utils';
import { CartItem } from './CartItem';

export function CartDrawer() {
  const { items, subtotal, totalItems, isDrawerOpen, closeDrawer } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useOverlay(isDrawerOpen, closeDrawer, panelRef);

  // Close when navigating to a new page.
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  if (!isDrawerOpen) return null;

  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={closeDrawer} aria-hidden="true" />

      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col border-l border-sand bg-linen"
      >
        <div className="flex h-14 items-center justify-between border-b border-sand px-5 md:h-[60px]">
          <h2 id="cart-drawer-title" className="label-caps text-ink">
            Your Cart {totalItems > 0 ? `(${totalItems})` : ''}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-ink hover:text-persimmon"
            aria-label="Close cart"
            data-autofocus
          >
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-serif text-xl italic text-ink">Your cart is empty.</p>
            <p className="mt-2 font-serif text-slateGrey">Well-made shirts are waiting.</p>
            <Link href="/shop" onClick={closeDrawer} className={buttonClasses({ variant: 'outline', className: 'mt-8' })}>
              Shop Shirts
            </Link>
          </div>
        ) : (
          <>
            {remainingForFreeShipping > 0 ? (
              <p className="border-b border-sand bg-sand/50 px-5 py-3 font-sans text-xs text-ink">
                Add {formatPrice(remainingForFreeShipping)} more for free shipping.
              </p>
            ) : (
              <p className="border-b border-sand bg-sand/50 px-5 py-3 font-sans text-xs text-ink">
                Your order ships free.
              </p>
            )}

            <ul className="flex-1 overflow-y-auto px-5" aria-label="Cart items">
              {items.map((item) => (
                <CartItem key={`${item.product.id}-${item.size}`} item={item} onNavigate={closeDrawer} />
              ))}
            </ul>

            <div className="border-t border-sand px-5 py-5">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs font-medium uppercase tracking-[0.14em]">Subtotal</span>
                <span className="text-base font-medium">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 font-serif text-sm italic text-slateGrey">Shipping calculated at checkout.</p>
              <div className="mt-5 space-y-2">
                <Link href="/checkout" onClick={closeDrawer} className={buttonClasses({ variant: 'primary', size: 'lg', width: 'full' })}>
                  Proceed to Checkout
                </Link>
                <Button variant="ghost" width="full" onClick={closeDrawer}>
                  Continue Shopping
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CartDrawer;
