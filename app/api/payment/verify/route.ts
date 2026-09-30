/**
 * POST /api/payment/verify
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId }
 *
 * Checks Razorpay's signature (HMAC SHA256). If valid, the order is marked
 * "confirmed" in Firestore + Sheets and the confirmation emails are sent.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getOrder, markOrderPaid, notifyOrderPlaced } from '@/lib/orders';
import { verifyPaymentSignature } from '@/lib/razorpay';
import type { VerifyPaymentRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

function readBody(body: unknown): VerifyPaymentRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const fields = ['razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature', 'orderId'] as const;
  if (!fields.every((field) => typeof b[field] === 'string' && (b[field] as string).length > 0)) return null;
  return {
    razorpayOrderId: b.razorpayOrderId as string,
    razorpayPaymentId: b.razorpayPaymentId as string,
    razorpaySignature: b.razorpaySignature as string,
    orderId: b.orderId as string,
  };
}

export async function POST(request: NextRequest) {
  let payload: VerifyPaymentRequest | null = null;
  try {
    payload = readBody(await request.json());
  } catch {
    payload = null;
  }
  if (!payload) {
    return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = payload;

  try {
    if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      return NextResponse.json({ error: 'Payment verification failed.' }, { status: 400 });
    }

    const existing = await getOrder(orderId);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    if (existing.razorpayOrderId && existing.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: 'Payment does not match this order.' }, { status: 400 });
    }

    const { order, changed } = await markOrderPaid(orderId, razorpayOrderId, razorpayPaymentId);
    if (changed) {
      await notifyOrderPlaced(order);
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error(`[api/payment/verify] Failed for ${orderId}:`, error);
    return NextResponse.json({ error: 'We could not confirm your payment.' }, { status: 500 });
  }
}
