/**
 * /api/admin/returns/[returnId]
 *
 * GET   — full request (damage photos, photo-check result) plus the order.
 * PATCH — body: { status?, adminDecision?, resolutionNote?, storeCreditAmount?, tpin? }
 *         Saving a store_credit decision or resolving into store credit requires `tpin`
 *         (checked against ADMIN_TPIN; wrong -> 401 "Incorrect TPIN").
 *         Resolving with store_credit adds a ledger credit to the customer's balance (once).
 *         Resolving with razorpay_refund (prepaid orders only) refunds through the Razorpay API (once).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getOrder } from '@/lib/orders';
import { getReturn, ReturnValidationError, updateReturn, validateAdminUpdate } from '@/lib/returns';
import { StoreCreditError } from '@/lib/store-credit';

export const dynamic = 'force-dynamic';
// Razorpay refund calls can take a few seconds.
export const maxDuration = 30;

function idFrom(params: { returnId: string }): string {
  return decodeURIComponent(params.returnId || '').trim();
}

export async function GET(_request: NextRequest, { params }: { params: { returnId: string } }) {
  const returnId = idFrom(params);
  try {
    const found = returnId ? await getReturn(returnId) : null;
    if (!found) return NextResponse.json({ error: 'Return not found.' }, { status: 404 });
    // The order gives the admin the phone number and pickup address.
    const order = await getOrder(found.orderId).catch(() => null);
    return NextResponse.json({ return: found, order });
  } catch (error) {
    console.error(`[api/admin/returns/${returnId}] Failed to load return:`, error);
    return NextResponse.json({ error: 'Could not load this return.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { returnId: string } }) {
  const returnId = idFrom(params);
  if (!returnId) return NextResponse.json({ error: 'Return ID is missing.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = validateAdminUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const tpin = body && typeof body === 'object' && 'tpin' in body ? String((body as { tpin?: unknown }).tpin ?? '') : undefined;
    const updated = await updateReturn(returnId, parsed.data, { tpin });
    return NextResponse.json({ return: updated });
  } catch (error) {
    if (error instanceof ReturnValidationError || error instanceof StoreCreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`[api/admin/returns/${returnId}] Failed to update return:`, error);
    return NextResponse.json({ error: 'Could not update this return. Please try again.' }, { status: 500 });
  }
}
