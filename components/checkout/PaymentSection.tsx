'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import type {
  Address,
  CartItem,
  CreateOrderRequest,
  CreateOrderResponse,
  CreatePaymentResponse,
  Order,
  PaymentMethod,
  SkipPaymentResponse,
  VerifyPaymentRequest,
} from '@/lib/types';
import { cn, formatPrice, LAST_ORDER_KEY } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Razorpay Checkout typings (loaded from checkout.razorpay.com)       */
/* ------------------------------------------------------------------ */

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', callback: (response: { error: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';


function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
    script.addEventListener('error', () => resolve(false));
    if (!existing) {
      script.src = RAZORPAY_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data ? String((data as { error: unknown }).error) : '';
    throw new Error(message || 'Something went wrong. Please try again.');
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface PaymentSectionProps {
  address: Address;
  email: string;
  items: CartItem[];
  /** Amount still due after store credit (what Razorpay / cash on delivery collects). */
  total: number;
  /** Applied discount code, re-validated by the server when the order is created. */
  discountCode?: string;
  /** Store credit the customer chose to apply; the server re-checks the real balance and caps it. */
  storeCreditToApply?: number;
}

export function PaymentSection({ address, email, items, total, discountCode, storeCreditToApply = 0 }: PaymentSectionProps) {
  /** Store credit covers everything: no payment method, just a free "Place Order". */
  const fullyCoveredByCredit = storeCreditToApply > 0 && total <= 0;
  const router = useRouter();
  const { user } = useAuth();
  const { clearCart } = useCart();

  const [method, setMethod] = useState<PaymentMethod>('razorpay');
  const [confirmingCod, setConfirmingCod] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pending online order kept so a cancelled payment can be retried without duplicating it. */
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  /**
   * Whether Cash on Delivery is offered (admin panel > Settings, Firestore config/settings.codEnabled).
   * Hidden until the setting loads so it never flashes on and then disappears.
   */
  const [codEnabled, setCodEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { codEnabled?: unknown } | null) => {
        if (!cancelled) setCodEnabled(data?.codEnabled !== false);
      })
      .catch(() => {
        // If settings can't be loaded, fall back to offering COD (the server still enforces the setting).
        if (!cancelled) setCodEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If COD gets switched off while selected, fall back to online payment.
  useEffect(() => {
    if (!codEnabled && method === 'cod') {
      setMethod('razorpay');
      setConfirmingCod(false);
    }
  }, [codEnabled, method]);

  const finish = (order: Order) => {
    try {
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Not critical — the confirmation page falls back to the order ID.
    }
    clearCart();
    router.push(`/order-confirmed?orderId=${encodeURIComponent(order.orderId)}`);
  };

  const createOrder = async (paymentMethod: PaymentMethod): Promise<Order> => {
    const token = user ? await user.getIdToken() : undefined;
    const request: CreateOrderRequest = {
      customerName: address.name,
      customerEmail: email,
      customerPhone: address.phone,
      shippingAddress: address,
      items: items.map((item) => ({ productId: item.product.id, size: item.size, quantity: item.quantity })),
      paymentMethod,
      ...(discountCode ? { discountCode } : {}),
      ...(user && storeCreditToApply > 0 ? { storeCreditToApply } : {}),
    };
    const { order } = await postJson<CreateOrderResponse>('/api/orders', request, token);
    return order;
  };

  const placeCodOrder = async () => {
    setProcessing(true);
    setError(null);
    try {
      const order = await createOrder('cod');
      finish(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place your order.');
      setProcessing(false);
    }
  };

  const payOnline = async () => {
    setProcessing(true);
    setError(null);
    try {
      const order = pendingOrder ?? (await createOrder('razorpay'));
      setPendingOrder(order);

      const payment = await postJson<CreatePaymentResponse | SkipPaymentResponse>('/api/payment/create-order', {
        orderId: order.orderId,
      });

      // Store credit covered the whole order — it is already confirmed, no Razorpay needed.
      if ('skip' in payment && payment.skip) {
        finish(order);
        return;
      }
      if (!('razorpayOrderId' in payment)) {
        throw new Error('Could not start payment.');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Could not load the payment window. Please check your connection and try again.');
      }

      const razorpay = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'Vellee Luxe',
        description: `Order ${order.orderId}`,
        order_id: payment.razorpayOrderId,
        prefill: { name: address.name, email, contact: `+91${address.phone}` },
        notes: { orderId: order.orderId },
        theme: { color: '#C8623D' },
        handler: async (response) => {
          setProcessing(true);
          try {
            const verifyRequest: VerifyPaymentRequest = {
              orderId: order.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            };
            const result = await postJson<{ success: boolean; order: Order }>('/api/payment/verify', verifyRequest);
            finish(result.order);
          } catch (err) {
            setError(
              err instanceof Error
                ? `${err.message} If money was deducted, please contact us with order ${order.orderId}.`
                : 'We could not verify your payment.',
            );
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setError('Payment was cancelled. Your items are still in your cart — you can try again.');
          },
        },
      });

      razorpay.on('payment.failed', (response) => {
        setError(response.error.description || 'Payment failed. Please try again or choose another method.');
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment.');
      setProcessing(false);
    }
  };

  const optionClass = (active: boolean) =>
    cn(
      'flex cursor-pointer items-start gap-4 border p-5 transition-colors',
      active ? 'border-ink bg-sand/40' : 'border-sand hover:border-pebble',
    );

  return (
    <section aria-labelledby="payment-heading" className="space-y-5">
      <h2 id="payment-heading" className="label-caps text-ink">
        Payment
      </h2>

      {fullyCoveredByCredit ? (
        <p className="border border-sand bg-sand/40 p-5 font-serif text-sm text-ink">
          Your store credit covers this whole order — no payment needed.
        </p>
      ) : (
      <fieldset className="space-y-3" disabled={processing}>
        <legend className="sr-only">Payment method</legend>
        <label className={optionClass(method === 'razorpay')}>
          <input
            type="radio"
            name="payment-method"
            value="razorpay"
            checked={method === 'razorpay'}
            onChange={() => {
              setMethod('razorpay');
              setConfirmingCod(false);
            }}
            className="mt-1 accent-persimmon"
          />
          <span>
            <span className="block font-sans text-sm font-medium text-ink">Pay Online</span>
            <span className="mt-1 block font-serif text-sm text-slateGrey">UPI, cards, net banking and wallets — secured by Razorpay.</span>
          </span>
        </label>
        {codEnabled ? (
          <label className={optionClass(method === 'cod')}>
            <input
              type="radio"
              name="payment-method"
              value="cod"
              checked={method === 'cod'}
              onChange={() => setMethod('cod')}
              className="mt-1 accent-persimmon"
            />
            <span>
              <span className="block font-sans text-sm font-medium text-ink">Cash on Delivery</span>
              <span className="mt-1 block font-serif text-sm text-slateGrey">Pay in cash when your order arrives.</span>
            </span>
          </label>
        ) : null}
      </fieldset>
      )}

      {error ? (
        <p role="alert" className="border border-persimmon/40 bg-persimmon/5 p-4 font-sans text-sm text-persimmon">
          {error}
        </p>
      ) : null}

      {fullyCoveredByCredit ? (
        <Button variant="primary" size="lg" width="full" loading={processing} onClick={payOnline}>
          Place Order (Free)
        </Button>
      ) : method === 'razorpay' ? (
        <Button variant="primary" size="lg" width="full" loading={processing} onClick={payOnline}>
          Pay {formatPrice(total)}
        </Button>
      ) : confirmingCod ? (
        <div className="space-y-4 border border-sand p-5">
          <p className="font-serif text-base text-ink">
            Place your order for <strong className="font-sans font-medium">{formatPrice(total)}</strong>, payable in cash on
            delivery to {address.city}?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" size="lg" width="mobile" loading={processing} onClick={placeCodOrder}>
              Confirm Order
            </Button>
            <Button variant="ghost" size="lg" width="mobile" disabled={processing} onClick={() => setConfirmingCod(false)}>
              Go Back
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="lg" width="full" onClick={() => setConfirmingCod(true)}>
          Place Order — {formatPrice(total)}
        </Button>
      )}

      <p className="text-center font-sans text-[11px] text-slateGrey">
        By placing your order you agree to our{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-persimmon">
          Terms
        </a>{' '}
        and{' '}
        <a href="/return-policy" className="underline underline-offset-2 hover:text-persimmon">
          Return Policy
        </a>
        .
      </p>
    </section>
  );
}

export default PaymentSection;
