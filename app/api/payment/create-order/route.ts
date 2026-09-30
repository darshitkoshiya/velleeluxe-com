/**
 * POST /api/payment/create-order
 * Body: { orderId: string, amount?: number }
 *
 * Creates a Razorpay order for one of our pending orders. The amount is read
 * from our saved order (never trusted from the browser). Razorpay uses paise.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { attachRazorpayOrder, getOrder } from '@/lib/orders';
import { getRazorpay } from '@/lib/razorpay';
import type { CreatePaymentResponse } from '@/lib/types';

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
    if (order.paymentMethod !== 'razorpay' || order.status !== 'pending') {
      return NextResponse.json({ error: 'This order does not need an online payment.' }, { status: 409 });
    }

    const amountInPaise = Math.round(order.total * 100);
    const razorpayOrder = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
      notes: { orderId: order.orderId, customerEmail: order.customerEmail },
    });

    await attachRazorpayOrder(order.orderId, razorpayOrder.id);

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
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
