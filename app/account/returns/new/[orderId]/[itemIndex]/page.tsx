'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Button, buttonClasses } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/Icons';
import { Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { getClientDb } from '@/lib/firebase';
import {
  isWithinReturnWindow,
  MAX_DAMAGE_PHOTOS,
  MAX_DAMAGE_PHOTOS_TOTAL_CHARS,
  RETURN_REASON_LABELS,
  RETURN_REASONS,
  RETURN_TYPE_LABELS,
  typeForReason,
} from '@/lib/returns-shared';
import type { Order, OrderItem, Product, ReturnReason, ReturnRequest, ReturnType as RequestType } from '@/lib/types';
import { cn, formatPrice } from '@/lib/utils';

type Step = 'reason' | 'details' | 'confirm';

const REASON_HINTS: Record<ReturnReason, string> = {
  size_doesnt_fit: 'Exchange for another size, or get store credit if yours is not available.',
  wrong_item: 'You received a different item from the one you ordered. Photos required.',
  damaged_defective: 'The item arrived with damage or a defect. Photos required.',
};

/** Per-photo size budget so all photos fit in one Firestore document. */
const PHOTO_CHAR_BUDGET = Math.floor(MAX_DAMAGE_PHOTOS_TOTAL_CHARS / MAX_DAMAGE_PHOTOS);

/** Shrinks a photo to a JPEG data URL small enough to store (no Firebase Storage yet). */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    let maxSide = 1200;
    let quality = 0.75;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('unreadable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= PHOTO_CHAR_BUDGET) return dataUrl;
      maxSide = Math.round(maxSide * 0.8);
      quality = Math.max(0.5, quality - 0.05);
    }
    throw new Error('too-large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadProduct(item: OrderItem): Promise<Product | null> {
  try {
    if (item.slug) {
      const response = await fetch(`/api/product/${encodeURIComponent(item.slug)}`);
      if (response.ok) return (await response.json()) as Product;
    }
    const response = await fetch('/api/products');
    if (!response.ok) return null;
    const products = (await response.json()) as Product[];
    return Array.isArray(products) ? products.find((product) => product.id === item.productId) ?? null : null;
  } catch {
    return null;
  }
}

export default function NewReturnPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string; itemIndex: string }>();
  const orderId = decodeURIComponent(params?.orderId ?? '');
  const itemIndex = Number.parseInt(params?.itemIndex ?? '', 10);

  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoaded, setProductLoaded] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'closed' | 'error'>('loading');

  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [type, setType] = useState<RequestType | null>(null);
  const [requestedSize, setRequestedSize] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
        const item = data?.items[itemIndex];
        if (!data || data.customerId !== user.uid || !item) {
          setState('not-found');
          return;
        }
        setOrder(data);
        setState(isWithinReturnWindow(data) ? 'ready' : 'closed');
        const found = await loadProduct(item);
        if (!cancelled) {
          setProduct(found);
          setProductLoaded(true);
        }
      } catch (err) {
        console.error('[returns] Could not load order:', err);
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, orderId, itemIndex]);

  if (authLoading || !user || state === 'loading') return <PageLoader label="Loading your order" />;

  const item = order?.items[itemIndex];
  const backHref = `/account/orders/${encodeURIComponent(orderId)}`;

  if (state !== 'ready' || !order || !item) {
    const message =
      state === 'closed'
        ? {
            title: 'Return window closed',
            body: 'Returns and exchanges are available for 7 days after delivery. Message us on WhatsApp if you need help.',
          }
        : state === 'error'
          ? { title: 'We could not load this order.', body: 'Please refresh the page and try again.' }
          : { title: 'Item not found', body: 'This order does not exist or belongs to another account.' };
    return (
      <div className="bg-linen">
        <div className="container-page py-20 text-center">
          <p className="font-serif text-2xl italic text-ink">{message.title}</p>
          <p className="mx-auto mt-2 max-w-md font-sans text-sm text-ink-muted">{message.body}</p>
          <Link href={backHref} className={buttonClasses({ variant: 'outline', size: 'md', width: 'auto', className: 'mt-8' })}>
            Back to Order
          </Link>
        </div>
      </div>
    );
  }

  // No per-size stock is tracked yet: when the product is in stock, every other listed size is offered.
  const productAvailable = product !== null && product.status === 'live' && (product.stock === 'unlimited' || product.stock > 0);
  const sizeOptions = productAvailable ? product.sizes.filter((size) => size.toUpperCase() !== item.size.toUpperCase()) : [];

  const chooseReason = (next: ReturnReason) => {
    setReason(next);
    setType(typeForReason(next));
    setRequestedSize('');
    setError(null);
    setStep('details');
  };

  const chooseStoreCredit = () => {
    setType('store_credit');
    setRequestedSize('');
    setError(null);
    setStep('confirm');
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setError(null);
    const room = MAX_DAMAGE_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_DAMAGE_PHOTOS} photos.`);
      return;
    }
    setProcessing(true);
    const added: string[] = [];
    let failed = false;
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith('image/')) {
        failed = true;
        continue;
      }
      try {
        added.push(await compressImage(file));
      } catch {
        failed = true;
      }
    }
    setPhotos((current) => [...current, ...added].slice(0, MAX_DAMAGE_PHOTOS));
    if (failed) setError('Some photos could not be added. Please use JPG or PNG images.');
    else if (files.length > room) setError(`Only ${MAX_DAMAGE_PHOTOS} photos can be added.`);
    setProcessing(false);
  };

  const continueFromDetails = () => {
    setError(null);
    if (type === 'size_exchange' && !requestedSize) {
      setError('Please choose the size you would like.');
      return;
    }
    if (type === 'damage_defect' && photos.length === 0) {
      setError('Please add at least one photo.');
      return;
    }
    if (type === 'damage_defect' && description.trim().length < 5) {
      setError('Please describe the issue in a few words.');
      return;
    }
    setStep('confirm');
  };

  const submit = async () => {
    if (!type || !reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: order.orderId,
          itemIndex,
          reason,
          type,
          requestedSize: type === 'size_exchange' ? requestedSize : undefined,
          damagePhotoUrls: type === 'damage_defect' ? photos : undefined,
          description: description.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { return?: ReturnRequest; error?: string };
      if (!response.ok || !data.return) throw new Error(data.error || 'We could not submit your request. Please try again.');
      router.replace(`/account/returns/${encodeURIComponent(data.return.returnId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit your request. Please try again.');
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 'confirm') {
      if (type === 'store_credit') setType('size_exchange');
      setStep('details');
    } else {
      setStep('reason');
    }
  };

  return (
    <div className="bg-linen">
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <Link href={backHref} className="font-sans text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-accent">
            Order {order.orderId}
          </Link>
          <h1 className="mt-3 font-sans text-2xl font-medium text-ink md:text-3xl">Return or Exchange</h1>

          {/* Item summary */}
          <div className="mt-8 flex gap-4 border-y border-sand py-4">
            <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-sand">
              {item.image ? <Image src={item.image} alt={item.productName} fill sizes="72px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="font-sans text-sm text-ink">{item.productName}</p>
              <p className="mt-1 font-sans text-xs text-ink-muted">Size {item.size}</p>
              <p className="mt-1 font-sans text-sm font-medium text-ink">{formatPrice(item.price)}</p>
            </div>
          </div>

          {/* Step 1: reason */}
          {step === 'reason' ? (
            <section className="mt-10">
              <h2 className="label-caps text-ink">Why are you returning this?</h2>
              <div className="mt-5 grid gap-3">
                {RETURN_REASONS.map((value) => (
                  <OptionCard
                    key={value}
                    title={RETURN_REASON_LABELS[value]}
                    description={REASON_HINTS[value]}
                    onClick={() => chooseReason(value)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Step 2a: size */}
          {step === 'details' && type === 'size_exchange' ? (
            <section className="mt-10">
              <h2 className="label-caps text-ink">Choose your new size</h2>
              {!productLoaded ? (
                <PageLoader label="Loading sizes" />
              ) : sizeOptions.length > 0 ? (
                <>
                  <div role="radiogroup" aria-label="New size" className="mt-5 flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        aria-checked={requestedSize === size}
                        onClick={() => setRequestedSize(size)}
                        className={cn(
                          'h-11 min-w-[3rem] rounded-sm border px-4 font-sans text-sm transition-colors',
                          requestedSize === size ? 'border-ink bg-ink text-linen' : 'border-sand text-ink hover:border-ink',
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 font-sans text-xs text-ink-muted">Only sizes currently in stock are shown.</p>
                </>
              ) : (
                <p className="mt-5 border border-sand bg-surface p-4 font-sans text-sm text-ink">
                  Other sizes of this product are not in stock right now. You can request store credit instead.
                </p>
              )}

              <button
                type="button"
                onClick={chooseStoreCredit}
                className="mt-6 font-sans text-xs uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-accent"
              >
                My size is not available
              </button>
            </section>
          ) : null}

          {/* Step 2b: photos */}
          {step === 'details' && type === 'damage_defect' ? (
            <section className="mt-10 space-y-6">
              <div>
                <h2 className="label-caps text-ink">{reason === 'wrong_item' ? 'Photos of the item you received' : 'Photos of the issue'}</h2>
                <p className="mt-2 font-sans text-sm text-ink-muted">
                  Add 1 to {MAX_DAMAGE_PHOTOS} clear photos
                  {reason === 'wrong_item' ? ' of the item and its label.' : ' showing the damage or defect, and the label.'} Photos
                  are checked automatically against your order.
                </p>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {photos.map((photo, index) => (
                    <li key={index} className="relative h-24 w-24 overflow-hidden border border-sand bg-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local base64 preview */}
                      <img src={photo} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-linen"
                      >
                        <CloseIcon width={12} height={12} />
                      </button>
                    </li>
                  ))}
                  {photos.length < MAX_DAMAGE_PHOTOS ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={processing}
                        className="flex h-24 w-24 items-center justify-center border border-dashed border-pebble font-sans text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:border-ink hover:text-ink disabled:opacity-50"
                      >
                        {processing ? 'Adding...' : 'Add Photo'}
                      </button>
                    </li>
                  ) : null}
                </ul>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void handleFiles(event)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
              <Textarea
                label="Describe the issue"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={
                  reason === 'wrong_item'
                    ? 'e.g. I ordered a white oxford item but received a blue linen item.'
                    : 'e.g. Torn seam on the left sleeve, noticed on opening the parcel.'
                }
              />
            </section>
          ) : null}

          {/* Step 3: confirm */}
          {step === 'confirm' && type && reason ? (
            <section className="mt-10">
              <h2 className="label-caps text-ink">Confirm your request</h2>
              <dl className="mt-5 space-y-3 border border-sand bg-surface p-5 font-sans text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Reason</dt>
                  <dd className="text-right text-ink">{RETURN_REASON_LABELS[reason]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Request</dt>
                  <dd className="text-right text-ink">{RETURN_TYPE_LABELS[type]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Item</dt>
                  <dd className="text-right text-ink">
                    {item.productName} / Size {item.size}
                  </dd>
                </div>
                {type === 'size_exchange' ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">New size</dt>
                    <dd className="text-right text-ink">{requestedSize}</dd>
                  </div>
                ) : null}
                {type === 'damage_defect' ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Photos</dt>
                    <dd className="text-right text-ink">{photos.length}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-4 font-sans text-sm text-ink-muted">
                {type === 'store_credit'
                  ? `Once we receive and inspect the item, ${formatPrice(item.price)} store credit will be added to your account. Store credit never expires.`
                  : type === 'damage_defect'
                    ? 'Your photos are checked against your order when you submit. After pickup and inspection we send a replacement in the same size or add store credit to your account.'
                    : 'We will arrange a pickup. Your new size ships once the original is received and inspected.'}
              </p>
              {type !== 'damage_defect' ? (
                <Textarea
                  className="mt-6"
                  label="Anything else we should know?"
                  optional
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              ) : null}
            </section>
          ) : null}

          {error ? (
            <p role="alert" className="mt-6 font-sans text-sm text-accent">
              {error}
            </p>
          ) : null}

          {step !== 'reason' ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {step === 'details' ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={continueFromDetails}
                  disabled={processing || (type === 'size_exchange' && sizeOptions.length === 0)}
                >
                  Continue
                </Button>
              ) : (
                <Button variant="primary" size="md" onClick={() => void submit()} loading={submitting}>
                  {submitting && type === 'damage_defect' ? 'Checking Photos' : 'Submit Request'}
                </Button>
              )}
              <Button variant="ghost" size="md" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OptionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full border border-sand bg-linen p-5 text-left transition-colors hover:border-ink"
    >
      <span className="block font-sans text-base font-medium text-ink group-hover:text-accent">{title}</span>
      <span className="mt-1 block font-serif text-sm italic text-ink-muted">{description}</span>
    </button>
  );
}
