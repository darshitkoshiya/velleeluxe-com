/**
 * /api/admin/discount-codes/[code]
 *
 * PATCH  — body: any of { active, type, value, minOrderAmount, maxUses, expiresAt }
 *          (send null / '' to clear minOrderAmount, maxUses or expiresAt); returns { ok: true }
 * DELETE — returns { ok: true }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  deleteDiscountCode,
  DiscountCodeNotFoundError,
  normaliseDiscountCode,
  parseDiscountCodeUpdates,
  updateDiscountCode,
} from '@/lib/discount-codes';

export const dynamic = 'force-dynamic';

function codeFrom(params: { code: string }): string {
  return normaliseDiscountCode(decodeURIComponent(params.code || ''));
}

export async function PATCH(request: NextRequest, { params }: { params: { code: string } }) {
  const code = codeFrom(params);
  if (!code) return NextResponse.json({ error: 'Discount code not found.' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseDiscountCodeUpdates(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await updateDiscountCode(code, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DiscountCodeNotFoundError) {
      return NextResponse.json({ error: 'Discount code not found.' }, { status: 404 });
    }
    console.error(`[api/admin/discount-codes/${code}] Failed to update code:`, error);
    return NextResponse.json({ error: 'Could not update discount code.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { code: string } }) {
  const code = codeFrom(params);
  if (!code) return NextResponse.json({ error: 'Discount code not found.' }, { status: 404 });

  try {
    await deleteDiscountCode(code);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DiscountCodeNotFoundError) {
      return NextResponse.json({ error: 'Discount code not found.' }, { status: 404 });
    }
    console.error(`[api/admin/discount-codes/${code}] Failed to delete code:`, error);
    return NextResponse.json({ error: 'Could not delete discount code.' }, { status: 500 });
  }
}
