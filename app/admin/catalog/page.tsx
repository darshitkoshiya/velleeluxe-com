/**
 * /admin/catalog — all color listings (one row per color variant).
 * Server wrapper: pre-computes SKU counts and family SKUs so the client table
 * can show "N sizes" and the family code without an N+1 fetch.
 */
import CatalogListClient from '@/components/admin/catalog/CatalogListClient';
import { getAllSkus, getFamilies } from '@/lib/catalog-admin';

export const dynamic = 'force-dynamic';

export default async function AdminCatalogPage({ searchParams }: { searchParams?: { familyId?: string } }) {
  const familyId = typeof searchParams?.familyId === 'string' ? searchParams.familyId.trim() : '';

  const skuCounts: Record<string, number> = {};
  const familySkus: Record<string, string> = {};
  try {
    const [skus, families] = await Promise.all([getAllSkus(), getFamilies()]);
    for (const s of skus) skuCounts[s.listingId] = (skuCounts[s.listingId] ?? 0) + 1;
    for (const f of families) familySkus[f.id] = f.familySku;
  } catch (err) {
    // Non-fatal: the client still loads listings and reports its own errors.
    console.error('[admin/catalog] Failed to load SKU counts / families:', err);
  }

  return <CatalogListClient skuCounts={skuCounts} familySkus={familySkus} familyId={familyId} />;
}
