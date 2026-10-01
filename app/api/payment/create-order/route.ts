/**
 * POST /api/payment/create-order
 * Body: { orderId: string, amount?: number }
 *
 * Creates a Razorpay order for one of our pending orders. The amount is read
 * from our saved order (never trusted from the browser). Razorpay uses paise.
 * Charges `amountChargedToPayment` (total minus store credit). When store credit
 * covers everything, returns `{ skip: true, orderId }` instead.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { amountDue, attachRazorpayOrder, getOrder } from '@/lib/orders';
import { getPaymentKeys } from '@/lib/payment-settings';
import { getRazorpay } from '@/lib/razorpay';
import type { CreatePaymentResponse, SkipPaymentResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let orderId = '';
  try {
    const body = (await request.json()) as { orderId?: unknown };
    orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
  }

  try {
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    // Fully paid by store credit: the order is already saved and confirmed, so skip Razorpay.
    const due = amountDue(order);
    if (due <= 0) {
      const skip: SkipPaymentResponse = { skip: true, orderId: order.orderId };
      return NextResponse.json(skip);
    }
    if (order.paymentMethod !== 'razorpay' || order.status !== 'pending') {
      return NextResponse.json({ error: 'This order does not need an online payment.' }, { status: 409 });
    }

    // Charge only what store credit did not cover.
    const amountInPaise = Math.round(due * 100);
    const razorpay = await getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
      notes: { orderId: order.orderId, customerEmail: order.customerEmail },
    });

    await attachRazorpayOrder(order.orderId, razorpayOrder.id);

    // Checkout must use the same key ID the order was created with, so prefer the
    // server's current key (Firestore or env) over the build-time public one.
    const { razorpayKeyId } = await getPaymentKeys();
    const keyId = razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const response: CreatePaymentResponse = {
      razorpayOrderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency,
      keyId,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error(`[api/payment/create-order] Failed for ${orderId}:`, error);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
