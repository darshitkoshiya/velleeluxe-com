/**
 * POST /api/discount/validate — body { code: string, subtotal: number }
 * Returns { valid, discountAmount?, error?, codeType?, codeValue? }
 *
 * Public (used by the checkout page). The order API re-validates the code
 * against the server-calculated subtotal, so this is for display only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { normaliseDiscountCode, validateDiscountCode } from '@/lib/discount-codes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { code?: unknown; subtotal?: unknown };
  try {
    body = (await request.json()) as { code?: unknown; subtotal?: unknown };
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // Check the format first so junk input never reaches Firestore.
  const code = normaliseDiscountCode(body?.code);
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Please enter a valid discount code.' }, { status: 400 });
  }
  const subtotal = Number(body?.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 10_000_000) {
    return NextResponse.json({ valid: false, error: 'Invalid order amount.' }, { status: 400 });
  }

  try {
    const result = await validateDiscountCode(code, subtotal);
    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error });
    }
    return NextResponse.json({
      valid: true,
      code: result.code.code,
      discountAmount: result.discountAmount,
      codeType: result.code.type,
      codeValue: result.code.value,
    });
  } catch (error) {
    console.error('[api/discount/validate] Failed to validate code:', error);
    return NextResponse.json({ valid: false, error: 'Could not check this code. Please try again.' }, { status: 500 });
  }
}
