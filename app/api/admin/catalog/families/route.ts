import { NextResponse } from 'next/server';
import { createFamily, getFamilies } from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, validateFamilySku } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const families = await getFamilies();
    return NextResponse.json({ families });
  } catch (err) {
    return errorResponse(err, 'Failed to load families.');
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const familySku = validateFamilySku(body);
    const family = await createFamily({ familySku });
    return NextResponse.json({ family });
  } catch (err) {
    return errorResponse(err, 'Failed to create family.');
  }
}
