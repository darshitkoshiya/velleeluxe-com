/**
 * /api/admin/customers/[email] — full detail for one customer (admin customer drawer).
 *
 * GET -> { customer, orders, storeCredit: { balance, transactions (last 5), totalTransactions },
 *          totalRefundedToSource, totalRefundedAsCredit }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse } from 'next/server';
import { getCustomerDetail } from '@/lib/customers';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function decodeEmail(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export async function GET(_request: Request, { params }: { params: { email: string } }) {
  const email = decodeEmail(params.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  try {
    const detail = await getCustomerDetail(email);
    if (!detail) return NextResponse.json({ error: 'No orders found for this customer.' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error('[api/admin/customers] Detail lookup failed:', error);
    return NextResponse.json({ error: 'Could not load this customer.' }, { status: 500 });
  }
}
