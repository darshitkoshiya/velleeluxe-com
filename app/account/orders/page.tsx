'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { OrderCard } from '@/components/account/OrderCard';
import { Button, buttonClasses } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { getClientDb } from '@/lib/firebase';
import type { Order } from '@/lib/types';

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Protected page: send signed-out visitors to sign in.
  useEffect(() => {
    if (!authLoading && !user) router.replace('/account/login?redirect=/account/orders');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await getDocs(query(collection(getClientDb(), 'orders'), where('customerId', '==', user.uid)));
        const list = snapshot.docs
          .map((doc) => doc.data() as Order)
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
    <div className="container-page py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-sand pb-8">
        <div>
          <p className="label-caps text-oxford">Your Account</p>
          <h1 className="mt-3 font-sans text-3xl font-medium text-ink">Orders</h1>
          <p className="mt-2 font-sans text-sm text-slateGrey">{user.displayName || user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/wishlist" className={buttonClasses({ variant: 'outline', size: 'sm', width: 'auto' })}>
            Wishlist
          </Link>
          <Button variant="ghost" size="sm" width="auto" onClick={() => void signOut()}>
            Sign Out
          </Button>
        </div>
      </div>

      <div className="mt-10">
        {error ? (
          <p role="alert" className="font-sans text-sm text-persimmon">
            {error}
          </p>
        ) : orders === null ? (
          <PageLoader label="Loading your orders" />
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-serif text-2xl italic text-ink">No orders yet.</p>
            <p className="mt-2 font-serif text-lg text-slateGrey">When you place an order, it will appear here.</p>
            <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
              Start Shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-6">
            {orders.map((order) => (
              <li key={order.orderId}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
