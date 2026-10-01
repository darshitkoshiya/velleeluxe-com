'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useFreeShippingThreshold, useShippingFee } from '@/hooks/useFreeShippingThreshold';
import { AddressForm, type AddressFormValues } from '@/components/checkout/AddressForm';
import { PaymentSection } from '@/components/checkout/PaymentSection';
import { buttonClasses } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { calculateShipping, formatPrice } from '@/lib/utils';

export default function CheckoutPage() {
  const { items, subtotal, hydrated } = useCart();
  const { user, loading: authLoading, isConfigured } = useAuth();
  const [guestChosen, setGuestChosen] = useState(false);
  const [details, setDetails] = useState<AddressFormValues | null>(null);
  const freeShippingThreshold = useFreeShippingThreshold();
  const shippingFee = useShippingFee();

  // Discount code
  const [codeInput, setCodeInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);

  // The discount depends on the subtotal, so drop it if the cart changes.
  useEffect(() => {
    setAppliedDiscount(null);
  }, [subtotal]);

  const applyCode = async () => {
    const code = codeInput.trim().toUpperCase();
    setCodeError(null);
    if (!/^[A-Z0-9]{3,20}$/.test(code)) {
      setCodeError('Please enter a valid discount code.');
      return;
    }
    setApplyingCode(true);
    try {
      const response = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        valid?: boolean;
        discountAmount?: number;
        error?: string;
      };
      if (data.valid && typeof data.discountAmount === 'number') {
        setAppliedDiscount({ code, amount: data.discountAmount });
        setCodeInput('');
      } else {
        setCodeError(data.error || 'This discount code is not valid.');
      }
    } catch {
      setCodeError('Could not check this code. Please try again.');
    } finally {
      setApplyingCode(false);
    }
  };

  // Store credit (signed-in customers only). The server re-checks the balance when the order is placed.
  const [creditBalance, setCreditBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(false);

  useEffect(() => {
    if (!user) {
      setCreditBalance(0);
      setUseCredit(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/store-credit/balance', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = (await response.json().catch(() => ({}))) as { balance?: unknown };
        const balance = typeof data.balance === 'number' && data.balance > 0 ? data.balance : 0;
        if (!cancelled) setCreditBalance(balance);
      } catch {
        if (!cancelled) setCreditBalance(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const removeCode = () => {
    setAppliedDiscount(null);
    setCodeError(null);
  };

  if (!hydrated || authLoading) return <PageLoader label="Loading checkout" />;

  if (items.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <h1 className="font-serif text-3xl italic text-ink">Your cart is empty</h1>
        <p className="mt-3 font-serif text-lg text-slateGrey">Add something to your bag before checking out.</p>
        <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-10' })}>
          Shop Now
        </Link>
      </div>
    );
  }

  // Display only — the server recalculates shipping with the same admin setting when the order is placed.
  const discountAmount = appliedDiscount ? Math.min(appliedDiscount.amount, subtotal) : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const shipping = calculateShipping(discountedSubtotal, freeShippingThreshold, shippingFee);
  const total = discountedSubtotal + shipping;
  const storeCreditApplied = user && useCredit ? Math.max(0, Math.min(creditBalance, total)) : 0;
  const amountDue = Math.max(0, total - storeCreditApplied);
  const showSignInChoice = isConfigured && !user && !guestChosen;

  return (
    <div className="container-page py-12 md:py-16">
      <h1 className="font-sans text-3xl font-medium text-ink">Checkout</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="space-y-10">
          {showSignInChoice ? (
            <section className="border border-sand p-6" aria-labelledby="account-choice-title">
              <h2 id="account-choice-title" className="label-caps text-ink">
                How would you like to check out?
              </h2>
              <p className="mt-3 font-serif text-base text-slateGrey">
                Sign in to track your orders and save your wishlist, or continue as a guest.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/account/login?redirect=/checkout"
                  className={buttonClasses({ variant: 'secondary', size: 'lg' })}
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setGuestChosen(true)}
                  className={buttonClasses({ variant: 'outline', size: 'lg' })}
                >
                  Continue as Guest
                </button>
              </div>
            </section>
          ) : (
            <>
              {user ? (
                <p className="font-sans text-sm text-slateGrey">
                  Signed in as <span className="text-ink">{user.email}</span>
                </p>
              ) : null}

              <section aria-labelledby="shipping-title">
                <div className="mb-6 flex items-center justify-between">
                  <h2 id="shipping-title" className="label-caps text-ink">
                    1. Shipping Details
                  </h2>
                  {details ? (
                    <button
                      type="button"
                      onClick={() => setDetails(null)}
                      className="font-sans text-xs text-slateGrey underline underline-offset-4 hover:text-persimmon"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>

                {details ? (
                  <address className="border border-sand p-5 font-sans text-sm not-italic leading-relaxed text-ink">
                    {details.address.name}
                    <br />
                    {details.address.line1}
                    {details.address.line2 ? (
                      <>
                        <br />
                        {details.address.line2}
                      </>
                    ) : null}
                    <br />
                    {details.address.city}, {details.address.state} {details.address.pincode}
                    <br />
                    <span className="text-slateGrey">
                      +91 {details.address.phone} &middot; {details.email}
                    </span>
                  </address>
                ) : (
                  <AddressForm
                    initialValues={{ email: user?.email ?? '', address: undefined }}
                    onSubmit={setDetails}
                    checkServiceability
                  />
                )}
              </section>

              {details ? (
                <div>
                  <h2 className="label-caps mb-6 text-ink">2. Payment</h2>
                  <PaymentSection
                    key={JSON.stringify({
                      details,
                      items: items.map((i) => [i.product.id, i.size, i.quantity]),
                      discountCode: appliedDiscount?.code ?? null,
                      storeCreditApplied,
                    })}
                    address={details.address}
                    email={details.email}
                    items={items}
                    total={amountDue}
                    discountCode={appliedDiscount?.code}
                    storeCreditToApply={storeCreditApplied}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside aria-labelledby="checkout-summary-title" className="h-fit border border-sand p-6 lg:sticky lg:top-24">
          <h2 id="checkout-summary-title" className="label-caps text-ink">
            Order Summary
          </h2>
          <ul className="mt-6 divide-y divide-sand">
            {items.map((item) => (
              <li key={`${item.product.id}-${item.size}`} className="flex gap-4 py-4 first:pt-0">
                <div className="relative h-20 w-[60px] shrink-0 overflow-hidden bg-sand">
                  {item.product.images[0] ? (
                    <Image src={item.product.images[0]} alt={item.product.name} fill sizes="60px" className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 font-sans">
                  <p className="text-[13px] text-ink">{item.product.name}</p>
                  <p className="mt-1 text-xs text-slateGrey">
                    Size {item.size} &middot; Qty {item.quantity}
                  </p>
                </div>
                <p className="font-sans text-sm text-ink">{formatPrice(item.product.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-sand pt-4 font-sans">
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="text-green-700" role="status">
                  {appliedDiscount.code} applied — {formatPrice(discountAmount)} off
                </p>
                <button
                  type="button"
                  onClick={removeCode}
                  aria-label={`Remove discount code ${appliedDiscount.code}`}
                  className="px-2 text-lg leading-none text-slateGrey hover:text-persimmon"
                >
                  &times;
                </button>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void applyCode();
                }}
              >
                <label htmlFor="discount-code" className="label-caps text-ink">
                  Discount Code
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="discount-code"
                    type="text"
                    value={codeInput}
                    onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                    placeholder="Enter code"
                    maxLength={20}
                    autoComplete="off"
                    disabled={applyingCode}
                    aria-invalid={codeError ? true : undefined}
                    aria-describedby={codeError ? 'discount-code-error' : undefined}
                    className="min-w-0 flex-1 border border-sand bg-transparent px-3 py-2 text-sm uppercase text-ink placeholder:normal-case placeholder:text-slateGrey focus:border-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={applyingCode || codeInput.trim() === ''}
                    className={buttonClasses({ variant: 'outline', size: 'sm', width: 'auto' })}
                  >
                    {applyingCode ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {codeError ? (
                  <p id="discount-code-error" role="alert" className="mt-2 text-xs text-red-600">
                    {codeError}
                  </p>
                ) : null}
              </form>
            )}
          </div>
          {user && creditBalance > 0 ? (
            <div className="mt-4 border-t border-sand pt-4 font-sans">
              <p className="label-caps text-ink">Store Credit</p>
              <p className="mt-2 text-sm text-slateGrey">
                You have <span className="text-ink">{formatPrice(creditBalance)}</span> store credit available
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(event) => setUseCredit(event.target.checked)}
                  className="accent-persimmon"
                />
                Apply store credit to this order
              </label>
              {useCredit ? (
                <p className="mt-2 text-xs text-green-700" role="status">
                  {formatPrice(storeCreditApplied)} will be applied
                </p>
              ) : null}
            </div>
          ) : null}
          <dl className="mt-4 space-y-3 border-t border-sand pt-4 font-sans text-sm">
            <div className="flex justify-between">
              <dt className="text-slateGrey">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {appliedDiscount ? (
              <div className="flex justify-between text-green-700">
                <dt>Discount ({appliedDiscount.code})</dt>
                <dd>&minus;{formatPrice(discountAmount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-slateGrey">Shipping</dt>
              <dd>{shipping === 0 ? 'Free' : formatPrice(shipping)}</dd>
            </div>
            {storeCreditApplied > 0 ? (
              <div className="flex justify-between text-green-700">
                <dt>Store credit</dt>
                <dd>&minus;{formatPrice(storeCreditApplied)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-sand pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd>{formatPrice(amountDue)}</dd>
            </div>
          </dl>
          {storeCreditApplied > 0 ? (
            <p className="mt-3 font-sans text-sm text-ink" role="status">
              {amountDue === 0
                ? '₹0 due — fully covered by store credit'
                : `${formatPrice(amountDue)} due via payment`}
            </p>
          ) : null}
          <p className="mt-3 font-sans text-[11px] text-slateGrey">Prices include all taxes.</p>
        </aside>
      </div>
    </div>
  );
}
