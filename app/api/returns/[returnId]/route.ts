/**
 * GET /api/returns/[returnId] — one of the signed-in customer's requests.
 * Requires `Authorization: Bearer <Firebase ID token>`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getReturn, toCustomerView, verifyCustomer } from '@/lib/returns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { returnId: string } }) {
  const customer = await verifyCustomer(request.headers.get('authorization'));
  if (!customer) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });

  const returnId = decodeURIComponent(params.returnId || '').trim();
  try {
    const found = returnId ? await getReturn(returnId) : null;
    // Same response for "missing" and "someone else's" so IDs cannot be probed.
    if (!found || found.customerId !== customer.uid) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }
    return NextResponse.json({ return: toCustomerView(found) });
  } catch (error) {
    console.error(`[api/returns/${returnId}] Failed to load return:`, error);
    return NextResponse.json({ error: 'Could not load this request.' }, { status: 500 });
  }
}
