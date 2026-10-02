import { NextResponse } from 'next/server';
import {
  deleteListing,
  deleteSkusForListing,
  getAdminListingDetail,
  getListing,
  updateListing,
} from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, validateListingFields } from '@/lib/catalog-validation';
import { deleteListingImages } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type Ctx = { params: { listingId: string } };

function idFrom(params: Ctx['params']): string {
  return decodeURIComponent(params.listingId || '').trim();
}

function notFound() {
  return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
}

export async function GET(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  try {
    const detail = await getAdminListingDetail(id);
    if (!detail) return notFound();
    return NextResponse.json({ detail });
  } catch (err) {
    return errorResponse(err, 'Failed to load listing.');
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  try {
    const body = await readJsonObject(request);
    if (body.familyId !== undefined) {
      return NextResponse.json({ error: 'familyId cannot be changed.' }, { status: 400 });
    }
    const fields = validateListingFields(body, true);
    const existing = await getListing(id);
    if (!existing) return notFound();
    const listing = await updateListing(id, fields);
    return NextResponse.json({ listing });
  } catch (err) {
    return errorResponse(err, 'Failed to update listing.');
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  try {
    const existing = await getListing(id);
    if (!existing) return notFound();
    const deletedSkus = await deleteSkusForListing(id);
    await deleteListing(id);
    // Best-effort: remove mirrored images from Firebase Storage (never fails the delete).
    await deleteListingImages(existing.images ?? [], existing.listingSku).catch(() => {});
    return NextResponse.json({ ok: true, deletedSkus });
  } catch (err) {
    return errorResponse(err, 'Failed to delete listing.');
  }
}
