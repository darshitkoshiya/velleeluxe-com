import { NextResponse } from 'next/server';
import { deleteFamily, deleteListingsForFamily, getFamily, updateFamily } from '@/lib/catalog-admin';
import { errorResponse, readJsonObject, validateFamilySku } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { familyId: string } };

function idFrom(params: Ctx['params']): string {
  return decodeURIComponent(params.familyId || '').trim();
}

function notFound() {
  return NextResponse.json({ error: 'Family not found.' }, { status: 404 });
}

export async function GET(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'familyId is required.' }, { status: 400 });
  try {
    const family = await getFamily(id);
    if (!family) return notFound();
    return NextResponse.json({ family });
  } catch (err) {
    return errorResponse(err, 'Failed to load family.');
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'familyId is required.' }, { status: 400 });
  try {
    const body = await readJsonObject(request);
    const update: { familySku?: string } = {};
    if (body.familySku !== undefined) update.familySku = validateFamilySku(body);
    const existing = await getFamily(id);
    if (!existing) return notFound();
    const family = await updateFamily(id, update);
    return NextResponse.json({ family });
  } catch (err) {
    return errorResponse(err, 'Failed to update family.');
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: 'familyId is required.' }, { status: 400 });
  try {
    const existing = await getFamily(id);
    if (!existing) return notFound();
    const deleted = await deleteListingsForFamily(id);
    await deleteFamily(id);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return errorResponse(err, 'Failed to delete family.');
  }
}
