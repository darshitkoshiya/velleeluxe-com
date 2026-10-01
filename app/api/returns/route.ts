/**
 * /api/returns — customer exchange / store credit / damage requests.
 *
 * Requires `Authorization: Bearer <Firebase ID token>`.
 *
 * GET  — the signed-in customer's requests, newest first (photos omitted).
 * POST — create a request. Body: { orderId, itemIndex, reason, type, requestedSize?, damagePhotoUrls?, description? }
 *        Checks: order belongs to the customer, item exists, order delivered within 7 days,
 *        and no request already exists for that item. Damage/defect photos are checked by
 *        Gemini Vision, which can approve, reject or send the request for admin review.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  createReturn,
  listCustomerReturns,
  ReturnValidationError,
  toCustomerView,
  validateCreateReturn,
  verifyCustomer,
} from '@/lib/returns';

export const dynamic = 'force-dynamic';
// The Gemini photo check can take several seconds.
export const maxDuration = 60;

const SIGN_IN_ERROR = 'Please sign in to continue.';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request.headers.get('authorization'));
  if (!customer) return NextResponse.json({ error: SIGN_IN_ERROR }, { status: 401 });

  try {
    const returns = await listCustomerReturns(customer.uid);
    return NextResponse.json({ returns });
  } catch (error) {
    console.error('[api/returns] Failed to list returns:', error);
    return NextResponse.json({ error: 'Could not load your requests.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const customer = await verifyCustomer(request.headers.get('authorization'));
  if (!customer) return NextResponse.json({ error: SIGN_IN_ERROR }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = validateCreateReturn(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const created = await createReturn(parsed.data, customer);
    return NextResponse.json({ return: toCustomerView(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof ReturnValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/returns] Failed to create return:', error);
    return NextResponse.json({ error: 'We could not submit your request. Please try again.' }, { status: 500 });
  }
}
