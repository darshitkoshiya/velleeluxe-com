/**
 * GET /api/admin/orders — every order, newest first.
 * Optional `?status=confirmed` (pending | confirmed | processing | shipped | delivered | cancelled).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { listOrders } from '@/lib/orders';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('status')?.toLowerCase() || '';
  let status: OrderStatus | undefined;
  if (raw && raw !== 'all') {
    if (!STATUSES.includes(raw as OrderStatus)) {
      return NextResponse.json({ error: `Unknown status "${raw}".` }, { status: 400 });
    }
    status = raw as OrderStatus;
  }

  try {
    const orders = await listOrders(status);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[api/admin/orders] Failed to load orders:', error);
    return NextResponse.json({ error: 'Could not load orders.' }, { status: 500 });
  }
}
