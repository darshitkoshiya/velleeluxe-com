/**
 * Razorpay (server-only).
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';

let instance: Razorpay | null = null;

/** Returns a Razorpay client. Created on first use so builds work without keys. */
export function getRazorpay(): Razorpay {
  if (!instance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
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
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set.');
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
