import { NextResponse } from 'next/server';
import { createSku, getListing, getSkus } from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, validateSkuFields } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { listingId: string } };

function idFrom(params: Ctx['params']): string {
  return decodeURIComponent(params.listingId || '').trim();
}

function notFound() {
  return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
}

export async function GET(_request: Request, { params }: Ctx) {
  const listingId = idFrom(params);
  if (!listingId) return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  try {
    const listing = await getListing(listingId);
    if (!listing) return notFound();
    const skus = await getSkus(listingId);
    return NextResponse.json({ skus });
  } catch (err) {
    return errorResponse(err, 'Failed to load SKUs.');
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const listingId = idFrom(params);
  if (!listingId) return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  try {
    const body = await readJsonObject(request);
    const f = validateSkuFields(body, false);
    const listing = await getListing(listingId);
    if (!listing) return notFound();

    const supplierPrice = f.supplierPrice as number;
    const markup = f.markup as number;
    const sku = await createSku({
      listingId,
      sku: f.sku as string,
      size: f.size as string,
      supplierPrice,
      markup,
      mrp: f.mrp as number,
      sellingPrice: f.sellingPrice ?? supplierPrice + markup,
      stockQuantity: f.stockQuantity ?? 0,
      barcode: f.barcode ?? '',
      status: f.status ?? 'active',
    });
    return NextResponse.json({ sku });
  } catch (err) {
    return errorResponse(err, 'Failed to create SKU.');
  }
}
