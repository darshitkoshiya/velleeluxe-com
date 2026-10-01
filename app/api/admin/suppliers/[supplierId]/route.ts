/**
 * /api/admin/suppliers/[supplierId]
 *
 * PATCH  — body: any of { name, spreadsheetId, sheetTab, driveFolderId, contactName, contactPhone, notes }
 *          returns { supplier: Supplier }
 * DELETE — returns { ok: true }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { deleteSupplier, parseSupplierBody, SupplierNotFoundError, updateSupplier } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

function idFrom(params: { supplierId: string }): string {
  return decodeURIComponent(params.supplierId || '').trim();
}

export async function PATCH(request: NextRequest, { params }: { params: { supplierId: string } }) {
  const supplierId = idFrom(params);
  if (!supplierId) return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseSupplierBody(body, true);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const supplier = await updateSupplier(supplierId, parsed.data);
    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
    }
    console.error(`[api/admin/suppliers/${supplierId}] Failed to update supplier:`, error);
    return NextResponse.json({ error: 'Could not save supplier.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { supplierId: string } }) {
  const supplierId = idFrom(params);
  if (!supplierId) return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });

  try {
    await deleteSupplier(supplierId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
    }
    console.error(`[api/admin/suppliers/${supplierId}] Failed to delete supplier:`, error);
    return NextResponse.json({ error: 'Could not delete supplier.' }, { status: 500 });
  }
}
