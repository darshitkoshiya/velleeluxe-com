/**
 * GET /api/admin/returns — every return request, newest first (photos omitted).
 * Query: `?status=requested` (or all), `?page=1`, `?pageSize=25` (max 100).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { listReturns } from '@/lib/returns';
import { RETURN_STATUSES } from '@/lib/returns-shared';
import type { ReturnStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get('status')?.toLowerCase() || '';
  let status: ReturnStatus | undefined;
  if (raw && raw !== 'all') {
    if (!RETURN_STATUSES.includes(raw as ReturnStatus)) {
      return NextResponse.json({ error: `Unknown status "${raw}".` }, { status: 400 });
    }
    status = raw as ReturnStatus;
  }
  const page = Number.parseInt(params.get('page') || '1', 10) || 1;
  const pageSize = Number.parseInt(params.get('pageSize') || '25', 10) || 25;

  try {
    const result = await listReturns({ status, page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/admin/returns] Failed to load returns:', error);
    return NextResponse.json({ error: 'Could not load returns.' }, { status: 500 });
  }
}
