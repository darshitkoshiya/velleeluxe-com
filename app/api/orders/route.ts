/**
 * POST /api/orders — create an order.
 *
 * Works for signed-in customers (send `Authorization: Bearer <Firebase ID token>`)
 * and for guests (no header). Prices are always recalculated on the server.
 *
 * - COD orders: saved as "confirmed" and emails are sent straight away.
 * - Online orders: saved as "pending"; emails are sent once payment is verified.
 * - Orders fully paid by store credit (`storeCreditToApply`): saved as "confirmed", emails sent now.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { DEFAULT_SETTINGS, getStoreSettings } from '@/lib/settings';
import { buildOrder, notifyOrderPlaced, OrderValidationError, saveNewOrder, validateOrderRequest } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = validateOrderRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Respect the admin "Cash on Delivery" switch even if someone bypasses the checkout page.
  if (parsed.data.paymentMethod === 'cod') {
    let codEnabled = DEFAULT_SETTINGS.codEnabled;
    try {
      codEnabled = (await getStoreSettings()).codEnabled;
    } catch (error) {
      console.error('[api/orders] Could not read store settings; using default COD setting:', error);
    }
    if (!codEnabled) {
      return NextResponse.json(
        { error: 'Cash on Delivery is not available right now. Please choose Pay Online.' },
        { status: 400 },
      );
    }
  }

  // Identify the customer if they are signed in.
  let customerId = 'guest';
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
      customerId = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
    }
  }

  try {
    const order = await buildOrder(parsed.data, customerId);
    await saveNewOrder(order);

    // COD orders and orders fully paid by store credit are confirmed now, so email straight away.
    if (order.paymentMethod === 'cod' || order.status === 'confirmed') {
      await notifyOrderPlaced(order);
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[api/orders] Failed to create order:', error);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }
}
