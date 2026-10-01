'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { returnStatusInfo, returnTypeInfo } from '@/components/account/returnStatus';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { effectiveDecision, RETURN_REASON_LABELS, RETURN_STATUS_LABELS, RETURN_TIMELINE } from '@/lib/returns-shared';
import type { ReturnRequest } from '@/lib/types';
import { cn, formatDate, formatPrice } from '@/lib/utils';

function whatsappHref(returnId: string): string | null {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (!number) return null;
  const text = `Hi! I need help with my return request ${returnId}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function ReturnDetailPage() {
  const router = useRouter();
  const params = useParams<{ returnId: string }>();
  const returnId = decodeURIComponent(params?.returnId ?? '');
  const { user, loading: authLoading } = useAuth();
  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !returnId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/${encodeURIComponent(returnId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (cancelled) return;
        if (response.status === 404) {
          setState('not-found');
          return;
        }
        const data = (await response.json().catch(() => ({}))) as { return?: ReturnRequest; error?: string };
        if (!response.ok || !data.return) throw new Error(data.error || 'Could not load this request.');
        setRequest(data.return);
        setState('ready');
      } catch (err) {
        console.error('[returns] Could not load return:', err);
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, returnId]);

  if (authLoading || !user || state === 'loading') return <PageLoader label="Loading your request" />;

  const helpHref = whatsappHref(returnId);

  if (state !== 'ready' || !request) {
    return (
      <div className="bg-linen">
        <div className="container-page py-20 text-center">
          <p className="font-serif text-2xl italic text-ink">
            {state === 'error' ? 'We could not load this request.' : 'Request not found'}
          </p>
          <p className="mt-2 font-sans text-sm text-ink-muted">
            {state === 'error' ? 'Please refresh the page and try again.' : 'This request does not exist or belongs to another account.'}
          </p>
          <Link href="/account/returns" className={buttonClasses({ variant: 'outline', size: 'md', width: 'auto', className: 'mt-8' })}>
            Back to My Returns
          </Link>
        </div>
      </div>
    );
  }

  const status = returnStatusInfo(request.status);
  const type = returnTypeInfo(request.type);
  const currentStep = RETURN_TIMELINE.indexOf(request.status);
  const resolved = request.status === 'resolved';
  const rejected = request.status === 'rejected';
  const underReview = request.status === 'pending_review';
  const decision = effectiveDecision(request);

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <Link href="/account/returns" className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-accent">
            My Returns
          </Link>

          <header className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-sand pb-8">
            <div>
              <h1 className="font-sans text-2xl font-medium text-ink md:text-3xl">Request {request.returnId}</h1>
              <p className="mt-2 font-sans text-sm text-ink-muted">
                Requested on <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
                <span className="mx-2 text-pebble">/</span>
                Order{' '}
                <Link
                  href={`/account/orders/${encodeURIComponent(request.orderId)}`}
                  className="text-ink underline underline-offset-4 hover:text-accent"
                >
                  {request.orderId}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={type.variant}>{type.label}</Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </header>

          {/* Status timeline */}
          <section aria-label="Request progress" className="mt-10">
            {rejected ? (
              <div className="border border-sand bg-surface p-5 font-sans text-sm text-ink">
                <p className="text-base font-medium">This request was not approved.</p>
                {request.verification?.reason ? <p className="mt-2 text-ink-muted">{request.verification.reason}</p> : null}
                {request.resolutionNote ? <p className="mt-2 font-serif italic text-ink-muted">{request.resolutionNote}</p> : null}
                <p className="mt-3 text-ink-muted">If you think this is a mistake, message us on WhatsApp with your request ID.</p>
              </div>
            ) : (
            <ol className="grid grid-cols-5">
              {RETURN_TIMELINE.map((step, index) => {
                const done = index <= currentStep;
                return (
                  <li key={step} className="relative flex flex-col items-center text-center">
                    {index > 0 ? (
                      <span
                        aria-hidden="true"
                        className={cn('absolute right-1/2 top-3.5 h-px w-full', done ? 'bg-ink' : 'bg-sand')}
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
                        'mt-2 font-sans text-[9px] font-medium uppercase tracking-[0.1em] sm:text-[11px] sm:tracking-[0.12em]',
                        done ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      {RETURN_STATUS_LABELS[step]}
                    </span>
                    <span className="sr-only">{done ? '(complete)' : '(upcoming)'}</span>
                  </li>
                );
              })}
            </ol>
            )}
          </section>

          {/* Outcome */}
          {resolved ? (
            <section className="mt-10 border border-sand bg-surface p-5 font-sans text-sm text-ink">
              <h2 className="label-caps text-ink">Outcome</h2>
              {decision === 'store_credit' ? (
                <p className="mt-3 text-base">
                  {formatPrice(request.storeCreditAmount ?? request.itemPrice)} store credit added to your account.{' '}
                  <Link href="/account/store-credit" className="underline underline-offset-4 hover:text-accent">
                    View statement
                  </Link>
                </p>
              ) : decision === 'razorpay_refund' ? (
                <p className="mt-3 text-base">
                  {formatPrice(request.refundAmount ?? request.itemPrice)} refunded to your original payment method. It
                  usually reaches your account within 5–7 business days.
                </p>
              ) : decision === 'exchange' ? (
                <p className="mt-3 text-base">
                  Exchange approved
                  {request.requestedSize ? ` to size ${request.requestedSize}` : ' in the same size'}. Your replacement is on its way.
                </p>
              ) : null}
              {request.resolutionNote ? <p className="mt-3 font-serif italic text-ink-muted">{request.resolutionNote}</p> : null}
            </section>
          ) : rejected ? null : (
            <p className="mt-10 border border-sand bg-surface p-4 font-sans text-sm text-ink">
              {underReview
                ? 'Our team is reviewing your photos. We will update this request within 1–2 working days.'
                : request.type === 'store_credit'
                  ? 'Store credit is added to your account after we receive and inspect the item.'
                  : request.type === 'damage_defect'
                    ? 'Your photos were verified. We will arrange a pickup; after inspection we send a replacement or add store credit.'
                    : 'We will arrange a pickup and send your new size once the item has been received and inspected.'}
            </p>
          )}

          {/* Item */}
          <section className="mt-12">
            <h2 className="label-caps text-ink">Item</h2>
            <div className="mt-4 flex gap-4 border-y border-sand py-4">
              <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-sand">
                {request.itemImage ? (
                  <Image src={request.itemImage} alt={request.itemProductName} fill sizes="72px" className="object-cover" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="font-sans text-sm text-ink">{request.itemProductName}</p>
                  <p className="mt-1 font-sans text-xs text-ink-muted">{RETURN_REASON_LABELS[request.reason] ?? ''}</p>
                  <p className="mt-1 font-sans text-xs text-ink-muted">
                    Size received {request.itemSize}
                    {request.requestedSize ? ` / Size requested ${request.requestedSize}` : ''}
                  </p>
                </div>
                <p className="mt-2 font-sans text-sm font-medium text-ink sm:mt-0">{formatPrice(request.itemPrice)}</p>
              </div>
            </div>
            {request.description ? (
              <p className="mt-4 font-sans text-sm text-ink-muted">
                <span className="text-ink">Your note: </span>
                {request.description}
              </p>
            ) : null}
            {request.damagePhotos && request.damagePhotos.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-3">
                {request.damagePhotos.map((photo, index) => (
                  <li key={index} className="relative h-24 w-24 overflow-hidden border border-sand bg-sand">
                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URLs */}
                    <img src={photo} alt={`Damage photo ${index + 1}`} className="h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Help */}
          <section className="mt-12 border border-sand bg-surface p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="font-sans text-base font-medium text-ink">Need help?</p>
              <p className="mt-1 font-serif text-sm italic text-ink-muted">Message us about this request and we will reply quickly.</p>
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
