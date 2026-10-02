/**
 * /admin/catalog/families — product families (grouping entities) with their listing counts.
 */
import Link from 'next/link';
import type { ProductFamily, ProductListing } from '@/lib/types';
import { getFamilies, getListings } from '@/lib/catalog-admin';
import PageHeader from '@/components/admin/ui/PageHeader';
import EmptyState from '@/components/admin/ui/EmptyState';
import CreateFamilyForm from '@/components/admin/catalog/CreateFamilyForm';
import {
  ADMIN_TABLE_CSS,
  MONO,
  SANS,
  btn,
  chip,
  countBadge,
  errorText,
  formatDate,
  swatch,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';

export const dynamic = 'force-dynamic';

export default async function AdminFamiliesPage() {
  let families: ProductFamily[] = [];
  let listings: ProductListing[] = [];
  let error: string | null = null;
  try {
    // One read each — count listings per family in memory (no N+1).
    [families, listings] = await Promise.all([getFamilies(), getListings()]);
  } catch (err) {
    console.error('[admin/catalog/families] Failed to load families:', err);
    error = 'Could not load families. Check the Firebase Admin settings in your environment variables.';
  }

  const byFamily = new Map<string, ProductListing[]>();
  for (const l of listings) {
    const arr = byFamily.get(l.familyId);
    if (arr) arr.push(l);
    else byFamily.set(l.familyId, [l]);
  }
  const emptyFamilies = families.filter((f) => !byFamily.has(f.id)).length;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>
      <PageHeader
        title="Product Families"
        subtitle="Grouping entities — each family contains multiple color listings"
        breadcrumbs={[{ label: 'Catalog', href: '/admin/catalog' }, { label: 'Families' }]}
        actions={<CreateFamilyForm />}
      />

      {error ? (
        <p role="alert" style={{ ...errorText, marginBottom: '16px' }}>
          {error}
        </p>
      ) : families.length === 0 ? (
        <div style={tableFrame}>
          <EmptyState
            title="No families yet"
            description="Sync your catalog to create families automatically."
            action={
              <Link href="/admin/catalog" style={btn('secondary')}>
                Go to Catalog
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <span style={chip()}>
              <strong style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{families.length}</strong> famil{families.length === 1 ? 'y' : 'ies'}
            </span>
            <span style={chip()}>
              <strong style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{listings.length}</strong> listing{listings.length === 1 ? '' : 's'}
            </span>
            {emptyFamilies > 0 ? (
              <span style={chip()}>
                <strong style={{ color: '#8A4500', fontWeight: 600 }}>{emptyFamilies}</strong> without listings
              </span>
            ) : null}
          </div>

          <div style={tableFrame}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Family SKU</th>
                  <th style={th}>ID</th>
                  <th style={th}>Listings</th>
                  <th style={th}>Created</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {families.map((f) => {
                  const children = byFamily.get(f.id) ?? [];
                  const href = `/admin/catalog?familyId=${encodeURIComponent(f.id)}`;
                  return (
                    <tr key={f.id} className="vl-row">
                      <td style={{ ...td, fontFamily: MONO, fontSize: '13px', fontWeight: 600 }}>
                        <Link href={href} style={{ color: 'var(--admin-text)', textDecoration: 'none' }}>
                          {f.familySku || '—'}
                        </Link>
                      </td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: '11px', color: 'var(--admin-text-subtle)' }} title={f.id}>
                        {f.id.slice(0, 12)}
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <span style={countBadge}>{children.length}</span>
                          {children.length > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {children.slice(0, 8).map((l) => (
                                <Link
                                  key={l.id}
                                  href={`/admin/catalog/${encodeURIComponent(l.id)}`}
                                  title={`${l.color || l.listingSku} — ${l.title}`}
                                  aria-label={`Open ${l.color || l.listingSku}`}
                                  style={{ display: 'inline-flex' }}
                                >
                                  <span style={swatch(l.colorCode, 12)} />
                                </Link>
                              ))}
                              {children.length > 8 ? (
                                <span style={{ fontSize: '11px', color: 'var(--admin-text-subtle)' }}>+{children.length - 8}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)' }}>No listings</span>
                          )}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: '12px', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(f.createdAt)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link href={href} style={btn('ghost', { size: 'sm' })}>
                          View listings →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
