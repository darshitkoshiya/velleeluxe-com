/**
 * Razorpay (server-only).
 *
 * API keys come from getPaymentKeys() — Firestore config/payment first, then the
 * RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars — so the admin can rotate them without a redeploy.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getPaymentKeys } from './payment-settings';

let instance: Razorpay | null = null;
/** The key pair the cached client was built with, so a key change builds a fresh client. */
let instanceKeys = '';

/** Returns a Razorpay client using the current keys. Created on first use so builds work without keys. */
export async function getRazorpay(): Promise<Razorpay> {
  const { razorpayKeyId: keyId, razorpayKeySecret: keySecret } = await getPaymentKeys();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Add the keys in Admin > Settings or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  const fingerprint = crypto.createHash('sha256').update(`${keyId}:${keySecret}`).digest('hex');
  if (!instance || instanceKeys !== fingerprint) {
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    instanceKeys = fingerprint;
  }
  return instance;
}

/** Constant-time comparison of two hex signatures. */
function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checks the signature Razorpay Checkout returns after a successful payment. */
export async function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<boolean> {
  const { razorpayKeySecret: secret } = await getPaymentKeys();
  if (!secret) throw new Error('Razorpay key secret is not configured.');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return signaturesMatch(expectedSignature, razorpaySignature);
}

/** Checks the X-Razorpay-Signature header on webhook calls. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set.');
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signaturesMatch(expectedSignature, signature);
}
