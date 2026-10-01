'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStoreCredit } from '@/hooks/useStoreCredit';
import { buttonClasses } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { cn, formatDate, formatPrice } from '@/lib/utils';

/** Read-only store credit statement for the signed-in customer. */
export default function StoreCreditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { balance, transactions, loading, error } = useStoreCredit();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  if (authLoading || !user) return <PageLoader />;

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="border-b border-sand pb-8">
            <Link href="/account" className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-accent">
              Account
            </Link>
            <h1 className="mt-3 font-sans text-3xl font-medium text-ink">Store Credit</h1>
          </div>

          {loading ? (
            <PageLoader label="Loading your store credit" />
          ) : error ? (
            <p role="alert" className="mt-10 font-sans text-sm text-accent">
              {error}
            </p>
          ) : (
            <>
              <section className="mt-10 border border-sand bg-surface p-6">
                <p className="label-caps text-ink-muted">Available balance</p>
                <p className="mt-2 font-sans text-4xl font-medium text-ink">{formatPrice(balance)} Store Credit</p>
                <p className="mt-2 font-serif text-sm italic text-ink-muted">Never expires. Use it on any future order.</p>
              </section>

              <section className="mt-12">
                <h2 className="label-caps text-ink">Statement</h2>
                {transactions.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="font-serif text-2xl italic text-ink">No store credit yet</p>
                    <p className="mt-2 font-sans text-sm text-ink-muted">Credit from approved returns will appear here.</p>
                    <Link href="/shop" className={buttonClasses({ variant: 'outline', size: 'md', width: 'auto', className: 'mt-8' })}>
                      Continue Shopping
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Column headings (tablet and up) */}
                    <div className="mt-4 hidden grid-cols-[110px_56px_110px_1fr_140px] gap-4 border-b border-sand pb-3 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted sm:grid">
                      <span>Date</span>
                      <span>Type</span>
                      <span>Amount</span>
                      <span>Reason</span>
                      <span>Order</span>
                    </div>
                    <ul className="divide-y divide-sand border-b border-sand sm:border-t-0">
                      {transactions.map((entry, index) => {
                        const isCredit = entry.type !== 'debit';
                        return (
                          <li
                            key={entry.id || `${entry.createdAt}-${index}`}
                            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 font-sans text-sm sm:grid-cols-[110px_56px_110px_1fr_140px] sm:items-start"
                          >
                            <time dateTime={entry.createdAt} className="text-ink-muted sm:order-none">
                              {formatDate(entry.createdAt)}
                            </time>
                            <span
                              className={cn(
                                'text-right font-medium sm:text-left',
                                isCredit ? 'text-green-700' : 'text-red-700',
                              )}
                            >
                              {isCredit ? 'CR' : 'DR'}
                            </span>
                            <span className={cn('font-medium', isCredit ? 'text-green-700' : 'text-red-700')}>
                              {isCredit ? '+' : '-'}
                              {formatPrice(Math.abs(entry.amount))}
                            </span>
                            <span className="col-span-2 text-ink sm:col-span-1">{entry.reason}</span>
                            <span className="col-span-2 break-all text-xs text-ink-muted sm:col-span-1 sm:text-sm">
                              {entry.orderId ? (
                                <Link
                                  href={`/account/orders/${encodeURIComponent(entry.orderId)}`}
                                  className="underline underline-offset-4 hover:text-accent"
                                >
                                  {entry.orderId}
                                </Link>
                              ) : (
                                '—'
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
