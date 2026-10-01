/**
 * GET  /api/admin/payment — returns { razorpayKeyId (masked), hasSecret }
 * POST /api/admin/payment — body { tpin, razorpayKeyId?, razorpayKeySecret? }
 *        -> TPIN checked against ADMIN_TPIN (wrong -> 401 "Incorrect TPIN").
 *        Returns the same masked shape as GET. The full secret is never returned or logged.
 *
 * Protected by HTTP Basic Auth in middleware.ts; the TPIN is an extra layer on top.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getPaymentKeys, maskKeyId, updatePaymentKeys, type PaymentKeys } from '@/lib/payment-settings';
import { assertAdminTpin, StoreCreditError } from '@/lib/store-credit';

export const dynamic = 'force-dynamic';

const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const MAX_KEY_LENGTH = 200;

async function maskedResponse() {
  const keys = await getPaymentKeys();
  return { razorpayKeyId: maskKeyId(keys.razorpayKeyId), hasSecret: Boolean(keys.razorpayKeySecret) };
}

export async function GET() {
  try {
    return NextResponse.json(await maskedResponse());
  } catch (error) {
    console.error('[api/admin/payment] Failed to read payment settings:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Could not load payment settings.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: { tpin?: unknown; razorpayKeyId?: unknown; razorpayKeySecret?: unknown };
  try {
    body = ((await request.json()) ?? {}) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    assertAdminTpin(body.tpin);
  } catch (error) {
    if (error instanceof StoreCreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not verify TPIN.' }, { status: 500 });
  }

  const updates: Partial<PaymentKeys> = {};

  if (body.razorpayKeyId !== undefined) {
    const keyId = typeof body.razorpayKeyId === 'string' ? body.razorpayKeyId.trim() : '';
    if (keyId) {
      if (keyId.length > MAX_KEY_LENGTH || !KEY_ID_PATTERN.test(keyId)) {
        return NextResponse.json({ error: 'Key ID must start with rzp_test_ or rzp_live_.' }, { status: 400 });
      }
      updates.razorpayKeyId = keyId;
    }
  }

  if (body.razorpayKeySecret !== undefined) {
    const secret = typeof body.razorpayKeySecret === 'string' ? body.razorpayKeySecret.trim() : '';
    if (secret) {
      if (secret.length > MAX_KEY_LENGTH || /\s/.test(secret)) {
        return NextResponse.json({ error: 'Key secret looks invalid.' }, { status: 400 });
      }
      updates.razorpayKeySecret = secret;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Enter a new key ID or key secret to save.' }, { status: 400 });
  }

  try {
    await updatePaymentKeys(updates);
    return NextResponse.json(await maskedResponse());
  } catch (error) {
    console.error('[api/admin/payment] Failed to save payment settings:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Could not save payment settings.' }, { status: 500 });
  }
}
