/**
 * /api/admin/store-credit — manual store credit adjustments (goodwill credits, corrections).
 *
 * GET  ?email=someone@example.com  or  ?uid=...
 *      -> { customer: { uid, email, name }, credit: { balance, transactions } }
 * POST { uid, type: 'credit'|'debit', amount, reason, orderId?, tpin }
 *      -> TPIN checked against ADMIN_TPIN (wrong -> 401 "Incorrect TPIN"); reason is mandatory.
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { adjustStoreCredit, assertAdminTpin, getStoreCredit, StoreCreditError } from '@/lib/store-credit';
import type { StoreCreditEntryType } from '@/lib/types';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function findCustomer(params: { email?: string; uid?: string }) {
  const auth = getAdminAuth();
  try {
    const user = params.uid ? await auth.getUser(params.uid) : await auth.getUserByEmail(params.email ?? '');
    return { uid: user.uid, email: user.email ?? '', name: user.displayName ?? '' };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-uid' || code === 'auth/invalid-email') return null;
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || '';
  const uid = request.nextUrl.searchParams.get('uid')?.trim() || '';
  if (!uid && !isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a customer email address or UID.' }, { status: 400 });
  }

  try {
    const customer = await findCustomer(uid ? { uid } : { email });
    if (!customer) return NextResponse.json({ error: 'No customer account was found.' }, { status: 404 });
    const credit = await getStoreCredit(customer.uid);
    return NextResponse.json({ customer, credit });
  } catch (error) {
    console.error('[api/admin/store-credit] Lookup failed:', error);
    return NextResponse.json({ error: 'Could not look up this customer.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object') throw new Error('bad body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  const type = body.type as StoreCreditEntryType;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim().slice(0, 64) : '';

  if (!uid) return NextResponse.json({ error: 'Customer is missing.' }, { status: 400 });
  if (type !== 'credit' && type !== 'debit') return NextResponse.json({ error: 'Choose credit or debit.' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });

  try {
    assertAdminTpin(body.tpin);
    const customer = await findCustomer({ uid });
    if (!customer) return NextResponse.json({ error: 'No customer account was found.' }, { status: 404 });
    const result = await adjustStoreCredit(uid, {
      type,
      amount: Number(body.amount),
      reason,
      orderId: orderId || undefined,
      createdBy: 'admin',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof StoreCreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/admin/store-credit] Adjustment failed:', error);
    return NextResponse.json({ error: 'Could not save the adjustment. Please try again.' }, { status: 500 });
  }
}
