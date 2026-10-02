import { NextResponse } from 'next/server';
import { deleteSku, getSku, updateSku } from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, validateSkuFields } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { skuId: string } };

function idFrom(params: Ctx['params']): string {
  return decodeURIComponent(params.skuId || '').trim();
}

function notFound() {
  return NextResponse.json({ error: 'SKU not found.' }, { status: 404 });
}

export async function GET(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'skuId is required.' }, { status: 400 });
  try {
    const sku = await getSku(id);
    if (!sku) return notFound();
    return NextResponse.json({ sku });
  } catch (err) {
    return errorResponse(err, 'Failed to load SKU.');
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'skuId is required.' }, { status: 400 });
  try {
    const body = await readJsonObject(request);
    if (body.listingId !== undefined) {
      return NextResponse.json({ error: 'listingId cannot be changed.' }, { status: 400 });
    }
    const f = validateSkuFields(body, true);
    const existing = await getSku(id);
    if (!existing) return notFound();

    // sellingPrice is always derived: recompute when supplierPrice or markup changes,
    // otherwise keep the stored value (any client-supplied sellingPrice is ignored).
    delete f.sellingPrice;
    if (f.supplierPrice !== undefined || f.markup !== undefined) {
      f.sellingPrice = (f.supplierPrice ?? existing.supplierPrice) + (f.markup ?? existing.markup);
    }

    const sku = await updateSku(id, f);
    return NextResponse.json({ sku });
  } catch (err) {
    return errorResponse(err, 'Failed to update SKU.');
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'skuId is required.' }, { status: 400 });
  try {
    const existing = await getSku(id);
    if (!existing) return notFound();
    await deleteSku(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'Failed to delete SKU.');
  }
}
