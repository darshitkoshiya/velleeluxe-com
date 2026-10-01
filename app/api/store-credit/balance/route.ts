/**
 * GET /api/store-credit/balance
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * Returns { balance } for the signed-in customer. Guests, missing/invalid tokens
 * and read failures all return { balance: 0 } so checkout never breaks.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getStoreCreditBalance } from '@/lib/store-credit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ balance: 0 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ balance: 0 });
  }

  try {
    const balance = await getStoreCreditBalance(uid);
    return NextResponse.json({ balance }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(`[api/store-credit/balance] Could not read balance for ${uid}:`, error);
    return NextResponse.json({ balance: 0 });
  }
}
