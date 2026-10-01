/**
 * Payment settings (server-only). Razorpay API keys live at config/payment:
 *   { razorpayKeyId, razorpayKeySecret, updatedAt }
 *
 * Each key falls back to its env var (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) when it is
 * not stored in Firestore. Never send the secret to the browser.
 */
import { getAdminDb } from './firebase-admin';

export interface PaymentKeys {
  razorpayKeyId: string;
  razorpayKeySecret: string;
}

function paymentRef() {
  return getAdminDb().collection('config').doc('payment');
}

export async function getPaymentKeys(): Promise<PaymentKeys> {
  const snap = await paymentRef().get();
  const data = snap.exists ? snap.data() : undefined;
  return {
    razorpayKeyId:
      typeof data?.razorpayKeyId === 'string' && data.razorpayKeyId
        ? data.razorpayKeyId
        : (process.env.RAZORPAY_KEY_ID ?? ''),
    razorpayKeySecret:
      typeof data?.razorpayKeySecret === 'string' && data.razorpayKeySecret
        ? data.razorpayKeySecret
        : (process.env.RAZORPAY_KEY_SECRET ?? ''),
  };
}

export async function updatePaymentKeys(keys: Partial<PaymentKeys>): Promise<void> {
  const payload = { ...keys, updatedAt: new Date().toISOString() };
  await paymentRef().set(payload, { mergeFields: Object.keys(payload) });
}

/** Masks a key ID for display, e.g. rzp_****_AbC123 (shows only the last 6 characters). */
export function maskKeyId(keyId: string): string {
  if (!keyId) return '';
  return `rzp_****_${keyId.slice(-6)}`;
}
