'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { returnStatusInfo, returnTypeInfo } from '@/components/account/returnStatus';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { ReturnRequest } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/returns', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as { returns?: ReturnRequest[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load your requests.');
        if (!cancelled) setReturns(data.returns ?? []);
      } catch (err) {
        console.error('[returns] Could not load returns:', err);
        if (!cancelled) setError('We could not load your requests. Please refresh the page.');
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
          <h1 className="mt-3 font-sans text-3xl font-medium text-ink">My Returns &amp; Exchanges</h1>
        </div>

        <div className="mt-10">
          {error ? (
            <p role="alert" className="font-sans text-sm text-accent">
              {error}
            </p>
          ) : returns === null ? (
            <PageLoader label="Loading your requests" />
          ) : returns.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl italic text-ink">No requests yet</p>
              <p className="mt-2 font-sans text-sm text-ink-muted">
                To exchange a size or report an issue, open a delivered order within 7 days of delivery.
              </p>
              <Link href="/account/orders" className={buttonClasses({ variant: 'outline', size: 'md', width: 'auto', className: 'mt-8' })}>
                View My Orders
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {returns.map((item) => {
                const status = returnStatusInfo(item.status);
                const type = returnTypeInfo(item.type);
                return (
                  <li key={item.returnId}>
                    <Link
                      href={`/account/returns/${encodeURIComponent(item.returnId)}`}
                      className="group flex gap-4 border border-sand bg-linen p-5 transition-colors hover:border-ink"
                    >
                      <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-sand">
                        {item.itemImage ? (
                          <Image src={item.itemImage} alt={item.itemProductName} fill sizes="72px" className="object-cover" />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-sans text-sm font-medium text-ink">{item.itemProductName}</p>
                            <p className="mt-1 font-sans text-xs text-ink-muted">
                              Size {item.itemSize}
                              {item.requestedSize ? ` to ${item.requestedSize}` : ''}
                              <span className="mx-2 text-pebble">/</span>
                              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                            </p>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Badge variant={type.variant}>{type.label}</Badge>
                          <span className="flex items-center gap-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-ink group-hover:text-accent">
                            View
                            <ArrowRightIcon width={16} height={16} />
                          </span>
                        </div>
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
