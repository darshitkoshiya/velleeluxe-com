/**
 * DELETE /api/admin/products/{id} — removes the override for a sheet product, or deletes a
 * manual product. `id` may be a sheet product ID, a manual product ID ("manual-<slug>") or a
 * manual product slug. Returns { ok: true, removed: 'override' | 'manual' }.
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse } from 'next/server';
import {
  deleteManualProduct,
  deleteProductOverride,
  getManualProduct,
  getProductOverride,
  MANUAL_ID_PREFIX,
  revalidateProductData,
} from '@/lib/product-overrides';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id).trim();
  if (!id || id.includes('/')) return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 });

  try {
    const override = await getProductOverride(id);
    if (override) {
      await deleteProductOverride(id);
      revalidateProductData();
      return NextResponse.json({ ok: true, removed: 'override' });
    }

    const slug = id.startsWith(MANUAL_ID_PREFIX) ? id.slice(MANUAL_ID_PREFIX.length) : id;
    const manual = slug ? await getManualProduct(slug) : null;
    if (manual) {
      await deleteManualProduct(slug);
      revalidateProductData();
      return NextResponse.json({ ok: true, removed: 'manual' });
    }

    return NextResponse.json({ error: 'No override or manual product found for this id.' }, { status: 404 });
  } catch (error) {
    console.error(`[api/admin/products/${id}] Failed to delete:`, error);
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  }
}
