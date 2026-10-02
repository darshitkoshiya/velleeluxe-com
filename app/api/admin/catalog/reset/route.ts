/**
 * POST /api/admin/catalog/reset
 * Wipes the legacy product-catalog collections ONLY:
 *   productOverrides, manualProducts, productCopy, schemaCache
 * Never touches suppliers, config, orders, customers, productViews,
 * productFamilies, productListings, productSkus, or anything else.
 * Requires the admin TPIN.
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { assertAdminTpin, StoreCreditError } from '@/lib/store-credit';
import { isPlainObject } from '@/lib/catalog-validation';

export const dynamic = 'force-dynamic';

const RESET_COLLECTIONS = ['productOverrides', 'manualProducts', 'productCopy', 'schemaCache'] as const;
type ResetCollection = (typeof RESET_COLLECTIONS)[number];
const BATCH_SIZE = 400;

async function wipeCollection(name: ResetCollection): Promise<number> {
  const db = getAdminDb();
  const refs = await db.collection(name).listDocuments();
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
  }
  return refs.length;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
  }

  try {
    assertAdminTpin(body.tpin);
  } catch (err) {
    if (err instanceof StoreCreditError) {
      // 401 for a wrong TPIN; 503 when ADMIN_TPIN is not configured.
      return NextResponse.json({ error: err.message }, { status: err.status === 503 ? 503 : 401 });
    }
    return NextResponse.json({ error: 'Incorrect TPIN' }, { status: 401 });
  }

  try {
    const deleted = {} as Record<ResetCollection, number>;
    for (const name of RESET_COLLECTIONS) {
      deleted[name] = await wipeCollection(name);
    }
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error('Catalog reset failed', err);
    const message = err instanceof Error && err.message ? err.message : 'Catalog reset failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
