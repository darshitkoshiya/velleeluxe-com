'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Order } from '@/lib/types';
import { formatPrice, LAST_ORDER_KEY } from '@/lib/utils';

function OrderConfirmedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(LAST_ORDER_KEY);
      const saved = raw ? (JSON.parse(raw) as Order) : null;
      if (saved && (!orderId || saved.orderId === orderId)) setOrder(saved);
    } catch {
      // Fall back to showing only the order ID.
    }
    setLoaded(true);
  }, [orderId]);

  if (!loaded) return <PageLoader />;

  const displayId = order?.orderId ?? orderId;

  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-persimmon text-persimmon">
          <CheckIcon width={26} height={26} />
        </span>
        <p className="label-caps mt-8 text-oxford">Order confirmed</p>
        <h1 className="mt-4 font-serif text-4xl italic text-ink">Thank you.</h1>
        <p className="mt-4 font-serif text-lg leading-relaxed text-slateGrey">
          {order ? `We've received your order, ${order.customerName.split(' ')[0]}.` : "We've received your order."} A
          confirmation email is on its way{order ? ` to ${order.customerEmail}` : ''}. We&rsquo;ll notify you once it ships.
        </p>
        {displayId ? (
          <p className="mt-6 font-sans text-sm text-ink">
            Order number: <strong className="font-medium">{displayId}</strong>
          </p>
        ) : null}
      </div>

      {order ? (
        <section aria-label="Order details" className="mx-auto mt-12 max-w-xl border border-sand p-6">
          <ul className="divide-y divide-sand">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.size}`} className="flex justify-between gap-4 py-3 font-sans text-sm">
                <span className="text-ink">
                  {item.productName}
                  <span className="block text-xs text-slateGrey">
                    Size {item.size} &middot; Qty {item.quantity}
                  </span>
                </span>
                <span className="text-ink">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-sand pt-4 font-sans text-sm">
            <div className="flex justify-between">
              <dt className="text-slateGrey">Shipping</dt>
              <dd>{order.shippingFee > 0 ? formatPrice(order.shippingFee) : 'Free'}</dd>
            </div>
            <div className="flex justify-between text-base font-medium">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slateGrey">Payment</dt>
              <dd>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="mx-auto mt-12 flex max-w-xl flex-col justify-center gap-3 sm:flex-row">
        <Link href="/account/orders" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          Track Your Order
        </Link>
        <Link href="/shop" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <OrderConfirmedContent />
    </Suspense>
  );
}
