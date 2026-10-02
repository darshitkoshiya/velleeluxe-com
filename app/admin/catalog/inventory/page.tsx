/**
 * /admin/catalog/inventory — stock levels for every SKU, lowest stock first.
 * Filter via ?filter=low | out | in (default: all).
 */
import Link from 'next/link';
import type { ProductListing, ProductSku } from '@/lib/types';
import { getAllSkus, getListings } from '@/lib/catalog-admin';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  MONO,
  SANS,
  btn,
  chip,
  errorText,
  stockTone,
  swatch,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'low' | 'out' | 'in';

const FILTERS: { key: Filter; label: string; test: (qty: number) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'low', label: 'Low Stock (≤5)', test: (q) => q > 0 && q <= 5 },
  { key: 'out', label: 'Out of Stock', test: (q) => q <= 0 },
  { key: 'in', label: 'In Stock (>5)', test: (q) => q > 5 },
];

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size.trim().toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

function StockBadge({ qty }: { qty: number }) {
  const tone = stockTone(qty);
  const label = qty <= 0 ? 'Out of Stock' : qty <= 5 ? `Low — ${qty}` : String(qty);
  if (qty > 5) {
    return <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{label}</span>;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: '999px',
        background: tone.bg,
        color: tone.fg,
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default async function AdminInventoryPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const filter: Filter = FILTERS.some((f) => f.key === searchParams?.filter) ? (searchParams?.filter as Filter) : 'all';

  let skus: ProductSku[] = [];
  let listings: ProductListing[] = [];
  let error: string | null = null;
  try {
    [skus, listings] = await Promise.all([getAllSkus(), getListings()]);
  } catch (err) {
    console.error('[admin/catalog/inventory] Failed to load inventory:', err);
    error = 'Could not load inventory. Check the Firebase Admin settings in your environment variables.';
  }

  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, skus.filter((s) => f.test(s.stockQuantity)).length])) as Record<Filter, number>;
  const active = FILTERS.find((f) => f.key === filter)!;

  const rows = skus
    .filter((s) => active.test(s.stockQuantity))
    .sort((a, b) => {
      if (a.stockQuantity !== b.stockQuantity) return a.stockQuantity - b.stockQuantity;
      const ta = listingMap.get(a.listingId)?.title ?? '';
      const tb = listingMap.get(b.listingId)?.title ?? '';
      if (ta !== tb) return ta.localeCompare(tb);
      return sizeRank(a.size) - sizeRank(b.size);
    });

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>
      <PageHeader title="Inventory" subtitle="Stock levels by SKU" breadcrumbs={[{ label: 'Catalog', href: '/admin/catalog' }, { label: 'Inventory' }]} />

      {error ? (
        <p role="alert" style={{ ...errorText, marginBottom: '16px' }}>
          {error}
        </p>
      ) : skus.length === 0 ? (
        <div style={tableFrame}>
          <EmptyState
            title="No inventory yet"
            description="Sync your catalog to populate inventory."
            action={
              <Link href="/admin/catalog" style={btn('secondary')}>
                Go to Catalog
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <nav aria-label="Stock filter" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {FILTERS.map((f) => {
              const isActive = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={f.key === 'all' ? '/admin/catalog/inventory' : `/admin/catalog/inventory?filter=${f.key}`}
                  aria-current={isActive ? 'page' : undefined}
                  style={chip(isActive)}
                >
                  {f.label}
                  <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{counts[f.key]}</span>
                </Link>
              );
            })}
          </nav>

          {rows.length === 0 ? (
            <div style={tableFrame}>
              <EmptyState title="Nothing here" description="No SKUs match this filter." />
            </div>
          ) : (
            <div style={tableFrame}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Product</th>
                    <th style={th}>Color</th>
                    <th style={th}>Size</th>
                    <th style={th}>SKU</th>
                    <th style={th}>Stock</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Supplier ₹</th>
                    <th style={{ ...th, textAlign: 'right' }}>SP ₹</th>
                    <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const l = listingMap.get(s.listingId);
                    const sp = s.sellingPrice || s.supplierPrice + s.markup;
                    return (
                      <tr key={s.id} className="vl-row">
                        <td style={{ ...td, fontWeight: 500 }}>{l?.title || <span style={{ color: 'var(--admin-text-subtle)' }}>Unknown listing</span>}</td>
                        <td style={td}>
                          {l ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span aria-hidden="true" style={swatch(l.colorCode)} />
                              {l.color || '—'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{s.size || '—'}</td>
                        <td style={{ ...td, fontFamily: MONO, fontSize: '12px', color: 'var(--admin-text-muted)' }}>{s.sku}</td>
                        <td style={td}>
                          <StockBadge qty={s.stockQuantity} />
                        </td>
                        <td style={td}>
                          <StatusBadge status={s.status} size="sm" />
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--admin-text-muted)' }}>{inr(s.supplierPrice)}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{inr(sp)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {l ? (
                            <Link href={`/admin/catalog/${encodeURIComponent(l.id)}`} style={btn('ghost', { size: 'sm' })}>
                              Edit
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
