/**
 * POST /api/pincode/check — body { pincode: string }
 * Returns a ServiceabilityResult { serviceable, courier?, estimatedDays?, cod?, error? }.
 *
 * Public (used by the checkout address form). Never fails closed: if the courier
 * APIs are down or unconfigured the lib answers { serviceable: true }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { checkPincodeServiceability } from '@/lib/pincode';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { pincode?: unknown };
  try {
    body = (await request.json()) as { pincode?: unknown };
  } catch {
    return NextResponse.json({ serviceable: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const pincode = typeof body?.pincode === 'string' ? body.pincode.trim() : '';
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ serviceable: false, error: 'Please enter a valid 6-digit pincode.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await checkPincodeServiceability(pincode));
  } catch (error) {
    console.error('[api/pincode/check] Unexpected failure:', error);
    return NextResponse.json({ serviceable: true });
  }
}
