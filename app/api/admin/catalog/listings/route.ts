import { NextResponse } from 'next/server';
import { createListing, getFamily, getListings } from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, reqString, validateListingFields } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const familyId = new URL(request.url).searchParams.get('familyId')?.trim() || undefined;
    const listings = await getListings(familyId);
    return NextResponse.json({ listings });
  } catch (err) {
    return errorResponse(err, 'Failed to load listings.');
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const familyId = reqString(body, 'familyId', 1, 200);
    const fields = validateListingFields(body, false);

    const family = await getFamily(familyId);
    if (!family) return NextResponse.json({ error: 'familyId does not refer to an existing family.' }, { status: 400 });

    const listing = await createListing({
      familyId,
      listingSku: fields.listingSku as string,
      title: fields.title as string,
      description: fields.description ?? '',
      brand: fields.brand ?? '',
      category: fields.category ?? '',
      color: fields.color ?? '',
      colorCode: fields.colorCode ?? '',
      images: fields.images ?? [],
      coverImage: fields.coverImage ?? '',
      status: fields.status ?? 'active',
    });
    return NextResponse.json({ listing });
  } catch (err) {
    return errorResponse(err, 'Failed to create listing.');
  }
}
