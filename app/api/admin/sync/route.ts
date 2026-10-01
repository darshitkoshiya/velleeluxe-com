/**
 * POST /api/admin/sync — force-refresh the product catalog immediately instead of
 * waiting for the 3-hour cache window. Protected by the admin Basic Auth middleware.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    revalidateTag('products');
    revalidateTag('catalog');
    return NextResponse.json({ ok: true, revalidatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[api/admin/sync]', error);
    return NextResponse.json({ error: 'Revalidation failed.' }, { status: 500 });
  }
}
