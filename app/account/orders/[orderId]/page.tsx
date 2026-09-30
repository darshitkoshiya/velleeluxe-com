'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { itemCount, orderStatusInfo } from '@/components/account/orderStatus';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { getClientDb } from '@/lib/firebase';
import type { Order, OrderStatus } from '@/lib/types';
import { cn, formatDate, formatPrice } from '@/lib/utils';

const STEPS = ['Ordered', 'Confirmed', 'Shipped', 'Delivered'] as const;

const STEP_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
};

function whatsappHref(orderId: string): string | null {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (!number) return null;
  const text = `Hi! I need help with my order ${orderId}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = decodeURIComponent(params?.orderId ?? '');
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await getDoc(doc(getClientDb(), 'orders', orderId));
        const data = snapshot.exists() ? (snapshot.data() as Order) : null;
        if (cancelled) return;
        // Only show orders that belong to the signed-in customer.
        if (!data || data.customerId !== user.uid) {
          setState('not-found');
          return;
        }
        setOrder(data);
        setState('ready');
      } catch (err) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
        if (cancelled) return;
        if (code === 'permission-denied') {
          setState('not-found');
        } else {
          console.error('[orders] Could not load order:', err);
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, orderId]);

  if (authLoading || !user || state === 'loading') return <PageLoader label="Loading your order" />;

  const helpHref = whatsappHref(orderId);

  if (state !== 'ready' || !order) {
    return (
      <div className="bg-linen">
        <div className="container-page py-20 text-center">
          <p className="font-serif text-2xl italic text-ink">
            {state === 'error' ? 'We could not load this order.' : 'Order not found'}
          </p>
          <p className="mt-2 font-sans text-sm text-ink-muted">
            {state === 'error' ? 'Please refresh the page and try again.' : 'This order does not exist or belongs to another account.'}
          </p>
          <Link href="/account/orders" className={buttonClasses({ variant: 'outline', size: 'md', width: 'auto', className: 'mt-8' })}>
            Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const status = orderStatusInfo(order.status);
  const currentStep = STEP_INDEX[order.status] ?? 0;
  const address = order.shippingAddress;
  const count = itemCount(order.items);

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <Link href="/account/orders" className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-accent">
            My Orders
          </Link>

          <header className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-sand pb-8">
            <div>
              <h1 className="font-sans text-2xl font-medium text-ink md:text-3xl">Order {order.orderId}</h1>
              <p className="mt-2 font-sans text-sm text-ink-muted">
                Placed on <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
              </p>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </header>

          {/* Status timeline */}
          <section aria-label="Order progress" className="mt-10">
            {order.status === 'cancelled' ? (
              <p className="border border-sand bg-surface p-4 font-sans text-sm text-ink">
                This order was cancelled. If you have any questions, message us on WhatsApp.
              </p>
            ) : (
              <ol className="grid grid-cols-4">
                {STEPS.map((step, index) => {
                  const done = index <= currentStep;
                  return (
                    <li key={step} className="relative flex flex-col items-center text-center">
                      {index > 0 ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute right-1/2 top-3.5 h-px w-full',
                            index <= currentStep ? 'bg-ink' : 'bg-sand',
                          )}
                        />
                      ) : null}
                      <span
                        className={cn(
                          'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border',
                          done ? 'border-ink bg-ink text-linen' : 'border-pebble bg-linen text-pebble',
                        )}
                      >
                        {done ? <CheckIcon width={14} height={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-pebble" />}
                      </span>
                      <span
                        className={cn(
                          'mt-2 font-sans text-[10px] font-medium uppercase tracking-[0.12em] sm:text-[11px]',
                          done ? 'text-ink' : 'text-ink-muted',
                        )}
                      >
                        {step}
                      </span>
                      <span className="sr-only">{done ? '(complete)' : '(upcoming)'}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {order.shippingInfo?.trackingNumber ? (
              <p className="mt-6 font-sans text-sm text-ink-muted">
                {order.shippingInfo.courier ? `${order.shippingInfo.courier} · ` : ''}Tracking number{' '}
                <span className="font-medium text-ink">{order.shippingInfo.trackingNumber}</span>
              </p>
            ) : null}
          </section>

          {/* Items */}
          <section className="mt-12">
            <h2 className="label-caps text-ink">
              Items <span className="text-ink-muted">({count})</span>
            </h2>
            <ul className="mt-4 divide-y divide-sand border-y border-sand">
              {order.items.map((item) => {
                const thumb = (
                  <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-sand">
                    {item.image ? <Image src={item.image} alt={item.productName} fill sizes="72px" className="object-cover" /> : null}
                  </div>
                );
                return (
                  <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-4">
                    {item.slug ? <Link href={`/product/${item.slug}`}>{thumb}</Link> : thumb}
                    <div className="flex min-w-0 flex-1 flex-col justify-between sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-ink">{item.productName}</p>
                        <p className="mt-1 font-sans text-xs text-ink-muted">
                          Size {item.size} / Qty {item.quantity}
                        </p>
                      </div>
                      <p className="mt-2 font-sans text-sm font-medium text-ink sm:mt-0">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {/* Shipping address */}
            <section>
              <h2 className="label-caps text-ink">Shipping Address</h2>
              <address className="mt-4 font-sans text-sm not-italic leading-relaxed text-ink">
                {address.name}
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.city}, {address.state} {address.pincode}
                <br />
                {address.country}
                {address.phone ? (
                  <>
                    <br />
                    <span className="text-ink-muted">{address.phone}</span>
                  </>
                ) : null}
              </address>
            </section>

            {/* Payment summary */}
            <section>
              <h2 className="label-caps text-ink">Payment Summary</h2>
              <dl className="mt-4 space-y-2 font-sans text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Subtotal</dt>
                  <dd className="text-ink">{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Shipping</dt>
                  <dd className="text-ink">{order.shippingFee > 0 ? formatPrice(order.shippingFee) : 'Free'}</dd>
                </div>
                <div className="flex justify-between border-t border-sand pt-3">
                  <dt className="font-medium text-ink">Total</dt>
                  <dd className="font-medium text-ink">{formatPrice(order.total)}</dd>
                </div>
                <div className="flex justify-between pt-1">
                  <dt className="text-ink-muted">Payment</dt>
                  <dd className="text-ink">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}</dd>
                </div>
              </dl>
            </section>
          </div>

          {/* Help */}
          <section className="mt-12 border border-sand bg-surface p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="font-sans text-base font-medium text-ink">Need help?</p>
              <p className="mt-1 font-serif text-sm italic text-ink-muted">Message us about this order and we will reply quickly.</p>
            </div>
            {helpHref ? (
              <a
                href={helpHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary', size: 'md', className: 'mt-4 sm:mt-0' })}
              >
                Chat on WhatsApp
              </a>
            ) : (
              <Link href="/contact" className={buttonClasses({ variant: 'secondary', size: 'md', className: 'mt-4 sm:mt-0' })}>
                Contact Us
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
