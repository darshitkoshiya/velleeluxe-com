/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay calls this for payment events — a safety net for when a customer
 * pays but closes their browser before our site hears back.
 *
 * Set up in Razorpay Dashboard > Settings > Webhooks:
 *   URL:    https://velleeluxe.com/api/webhooks/razorpay
 *   Secret: same value as RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, order.paid, payment.failed
 */
import { NextResponse, type NextRequest } from 'next/server';
import { findOrderIdByRazorpayOrderId, markOrderPaid, notifyOrderPlaced } from '@/lib/orders';
import { verifyWebhookSignature } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string | null; status: string; error_description?: string | null } };
    order?: { entity: { id: string; receipt?: string; notes?: Record<string, string> } };
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  try {
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }
  } catch (error) {
    console.error('[webhooks/razorpay] Signature check failed:', error);
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const payment = event.payload.payment?.entity;
    const razorpayOrder = event.payload.order?.entity;

    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        const razorpayOrderId = razorpayOrder?.id ?? payment?.order_id;
        if (!razorpayOrderId || !payment) break;

        const orderId =
          razorpayOrder?.notes?.orderId || razorpayOrder?.receipt || (await findOrderIdByRazorpayOrderId(razorpayOrderId));
        if (!orderId) {
          console.warn(`[webhooks/razorpay] No order found for Razorpay order ${razorpayOrderId}.`);
          break;
        }

        const { order, changed } = await markOrderPaid(orderId, razorpayOrderId, payment.id);
        if (changed) {
          await notifyOrderPlaced(order);
        }
        break;
      }
      case 'payment.failed': {
        console.warn(
          `[webhooks/razorpay] Payment ${payment?.id} failed for Razorpay order ${payment?.order_id}: ${payment?.error_description ?? 'unknown reason'}`,
        );
        break;
      }
      default:
        // Other events are acknowledged and ignored.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // A 500 makes Razorpay retry later.
    console.error(`[webhooks/razorpay] Failed to process ${event.event}:`, error);
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}
