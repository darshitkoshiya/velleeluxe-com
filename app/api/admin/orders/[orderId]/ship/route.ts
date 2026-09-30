/**
 * POST /api/admin/orders/[orderId]/ship
 * Body: { courier?: string, trackingNumber?: string }
 *
 * 1. Firestore: status -> "shipped", adds shippingInfo
 * 2. Google Sheets (Orders tab): status column -> "shipped"
 * 3. Emails the customer a shipping confirmation
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { markOrderShipped, OrderNotShippableError } from '@/lib/orders';
import { sendShippingConfirmation } from '@/lib/resend';
import type { TrackingInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 100): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = (params.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is missing.' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // Empty body is fine — courier and tracking number are optional.
  }

  const courier = clean(body.courier);
  const trackingNumber = clean(body.trackingNumber);

  let order;
  try {
    order = await markOrderShipped(orderId, { courier, trackingNumber });
  } catch (error) {
    if (error instanceof OrderNotShippableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(`[api/admin/ship] Failed to mark ${orderId} as shipped:`, error);
    return NextResponse.json({ error: 'Could not update the order. Please try again.' }, { status: 500 });
  }

  // The order is already shipped at this point — an email failure is reported, not fatal.
  let emailSent = true;
  try {
    const trackingInfo: TrackingInfo | undefined =
      courier || trackingNumber ? { courier, trackingNumber } : undefined;
    await sendShippingConfirmation(order, trackingInfo);
  } catch (error) {
    emailSent = false;
    console.error(`[api/admin/ship] Shipping email failed for ${orderId}:`, error);
  }

  return NextResponse.json({ success: true, emailSent });
}
