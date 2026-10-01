/**
 * GET  /api/admin/discount-codes — returns { codes: DiscountCode[] }
 * POST /api/admin/discount-codes — body { code, type, value, minOrderAmount?, maxUses?, expiresAt? }
 *                                  returns { code: DiscountCode }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  createDiscountCode,
  DiscountCodeExistsError,
  listDiscountCodes,
  parseNewDiscountCode,
} from '@/lib/discount-codes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const codes = await listDiscountCodes();
    return NextResponse.json({ codes });
  } catch (error) {
    console.error('[api/admin/discount-codes] Failed to list codes:', error);
    return NextResponse.json({ error: 'Could not load discount codes.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseNewDiscountCode(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await createDiscountCode(parsed.data);
    return NextResponse.json({ code: parsed.data }, { status: 201 });
  } catch (error) {
    if (error instanceof DiscountCodeExistsError) {
      return NextResponse.json({ error: `Code ${parsed.data.code} already exists.` }, { status: 409 });
    }
    console.error('[api/admin/discount-codes] Failed to create code:', error);
    return NextResponse.json({ error: 'Could not create discount code.' }, { status: 500 });
  }
}
