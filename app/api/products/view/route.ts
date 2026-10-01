import { NextResponse } from 'next/server';
import { recordProductView } from '@/lib/featured-products';

export const dynamic = 'force-dynamic';

const SLUG_PATTERN = /^[a-zA-Z0-9-]{1,100}$/;

/** Public: logs one product page view. Fire-and-forget from the client. */
export async function POST(request: Request) {
  let slug: unknown;
  try {
    ({ slug } = (await request.json()) as { slug?: unknown });
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  }
  try {
    await recordProductView(slug);
  } catch (error) {
    console.error('[api/products/view] Failed:', error);
  }
  return NextResponse.json({ ok: true });
}
