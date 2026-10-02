/**
 * GET  /api/admin/suppliers — returns { suppliers: Supplier[] } (ordered by name)
 * POST /api/admin/suppliers — body { name, spreadsheetId, sheetTab?, driveFolderId?, contactName?, contactPhone?, notes?, margin? }
 *                             returns { supplier: Supplier }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createSupplier, getSuppliers, parseSupplierBody, DEFAULT_SHEET_TAB } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const suppliers = await getSuppliers();
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('[api/admin/suppliers] Failed to load suppliers:', error);
    return NextResponse.json({ error: 'Could not load suppliers.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseSupplierBody(body, false);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  try {
    const supplier = await createSupplier({
      name: data.name ?? '',
      spreadsheetId: data.spreadsheetId ?? '',
      sheetTab: data.sheetTab || DEFAULT_SHEET_TAB,
      driveFolderId: data.driveFolderId ?? '',
      contactName: data.contactName ?? '',
      contactPhone: data.contactPhone ?? '',
      notes: data.notes ?? '',
      margin: data.margin ?? 0,
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('[api/admin/suppliers] Failed to create supplier:', error);
    return NextResponse.json({ error: 'Could not save supplier.' }, { status: 500 });
  }
}
