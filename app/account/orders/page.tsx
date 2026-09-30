'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { itemCount, orderStatusInfo } from '@/components/account/orderStatus';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { getClientDb } from '@/lib/firebase';
import type { Order } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Protected page: send signed-out visitors to the account page to sign in.
  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Orders are linked to the customer by `customerId` (see lib/orders.ts).
        // Sorted here rather than with orderBy so no composite Firestore index is needed.
        const snapshot = await getDocs(query(collection(getClientDb(), 'orders'), where('customerId', '==', user.uid)));
        const list = snapshot.docs
          .map((d) => d.data() as Order)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        if (!cancelled) setOrders(list);
      } catch (err) {
        console.error('[orders] Could not load orders:', err);
        if (!cancelled) setError('We could not load your orders. Please refresh the page.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) return <PageLoader />;

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <div className="border-b border-sand pb-8">
          <Link href="/account" className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-accent">
            Account
          </Link>
          <h1 className="mt-3 font-sans text-3xl font-medium text-ink">My Orders</h1>
        </div>

        <div className="mt-10">
          {error ? (
            <p role="alert" className="font-sans text-sm text-accent">
              {error}
            </p>
          ) : orders === null ? (
            <PageLoader label="Loading your orders" />
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl italic text-ink">No orders yet</p>
              <p className="mt-2 font-sans text-sm text-ink-muted">When you place an order, it will appear here.</p>
              <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
                Start Shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => {
                const status = orderStatusInfo(order.status);
                const count = itemCount(order.items);
                return (
                  <li key={order.orderId}>
                    <Link
                      href={`/account/orders/${encodeURIComponent(order.orderId)}`}
                      className="group block border border-sand bg-linen p-5 transition-colors hover:border-ink"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-medium text-ink">{order.orderId}</p>
                          <p className="mt-1 font-sans text-xs text-ink-muted">
                            <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
                          </p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-sand pt-4">
                        <p className="font-sans text-sm text-ink-muted">
                          {count} {count === 1 ? 'item' : 'items'}
                          <span className="mx-2 text-pebble">/</span>
                          <span className="font-medium text-ink">{formatPrice(order.total)}</span>
                        </p>
                        <span className="flex items-center gap-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-ink group-hover:text-accent">
                          View
                          <ArrowRightIcon width={16} height={16} />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
