'use client';

/**
 * Client body of /admin/catalog — listings table, sync, bulk delete and the legacy reset tool.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductListing } from '@/lib/types';
import { errMsg, readJson, type Flash } from '@/components/admin/catalog-ui';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  DANGER_BG,
  DANGER_BORDER,
  MONO,
  OK,
  PLACEHOLDER_BG,
  SANS,
  btn,
  chip,
  countBadge,
  errorText,
  fieldInput,
  fieldLabel,
  swatch,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';

/* ------------------------------------------------------------------ */
/* Reset legacy data (collapsible danger box)                          */
/* ------------------------------------------------------------------ */

function ResetLegacySection() {
  const [open, setOpen] = useState(false);
  const [tpin, setTpin] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const reset = async () => {
    if (!tpin.trim()) {
      setFlash({ kind: 'error', text: 'Enter the admin TPIN.' });
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const response = await fetch('/api/admin/catalog/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpin: tpin.trim() }),
      });
      const data = await readJson<{ ok?: boolean; deleted?: Record<string, number> }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Reset failed.');
      const summary = Object.entries(data.deleted ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      setFlash({ kind: 'ok', text: `Legacy data cleared. ${summary}` });
      setTpin('');
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Reset failed.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{
        marginTop: '40px',
        border: `1px solid ${DANGER_BORDER}`,
        background: '#FBF4F1',
        borderRadius: '8px',
        padding: '14px 18px',
        fontFamily: SANS,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: SANS,
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: DANGER,
        }}
      >
        {open ? '▾' : '▸'} Reset Catalog
      </button>
      {open ? (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: DANGER, background: DANGER_BG, padding: '10px 14px', borderRadius: '6px' }}>
            This permanently deletes all data from productOverrides, manualProducts, productCopy and schemaCache. It does NOT
            delete the new catalog (families, listings, SKUs), suppliers, orders, customers or settings.
          </p>
          <div style={{ maxWidth: '260px' }}>
            <label htmlFor="reset-tpin" style={fieldLabel}>
              Admin TPIN
            </label>
            <input
              id="reset-tpin"
              type="password"
              autoComplete="off"
              value={tpin}
              disabled={busy}
              onChange={(e) => setTpin(e.target.value)}
              style={{ ...fieldInput, borderColor: DANGER_BORDER }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void reset()} disabled={busy} style={btn('danger', { disabled: busy })}>
              {busy ? 'Resetting…' : 'Reset Legacy Data'}
            </button>
            {flash ? (
              <span role={flash.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '13px', color: flash.kind === 'error' ? DANGER : OK }}>
                {flash.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page body                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  /** listingId -> number of SKUs (sizes). */
  skuCounts: Record<string, number>;
  /** familyId -> familySku. */
  familySkus: Record<string, string>;
  /** Optional family filter from ?familyId=. */
  familyId?: string;
}

export default function CatalogListClient({ skuCounts, familySkus, familyId = '' }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ families: number; listings: number; skus: number; warnings: string[] } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLimit, setSyncLimit] = useState<string>('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const loadListings = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const qs = familyId ? `?familyId=${encodeURIComponent(familyId)}` : '';
        const response = await fetch(`/api/admin/catalog/listings${qs}`, { cache: 'no-store' });
        const data = await readJson<{ listings?: ProductListing[] }>(response);
        if (!response.ok || !Array.isArray(data.listings)) throw new Error(data.error || 'Could not load listings.');
        if (!isCancelled()) {
          setListings(data.listings);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled()) setError(errMsg(err, 'Could not load listings.'));
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [familyId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadListings(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadListings]);

  // Drop selections that no longer exist (after reload / delete).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(listings.map((l) => l.id));
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [listings]);

  const syncCatalog = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const limit = syncLimit.trim() ? parseInt(syncLimit, 10) : undefined;
      const body: Record<string, unknown> = {};
      if (limit && limit > 0) body.familyLimit = limit;
      const response = await fetch('/api/admin/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJson<{
        ok?: boolean;
        stats?: { families: number; listings: number; skus: number; warnings?: string[] };
      }>(response);
      if (!response.ok || !data.ok || !data.stats) throw new Error(data.error || 'Sync failed.');
      setSyncResult({
        families: data.stats.families,
        listings: data.stats.listings,
        skus: data.stats.skus,
        warnings: Array.isArray(data.stats.warnings) ? data.stats.warnings : [],
      });
      await loadListings();
      router.refresh(); // refresh server-computed SKU counts / family SKUs
    } catch (err) {
      setSyncError(errMsg(err, 'Sync failed.'));
    } finally {
      setSyncing(false);
    }
  };

  const deleteSelected = async () => {
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selected);
    const failed: string[] = [];
    for (const id of ids) {
      try {
        const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await readJson<{ ok?: boolean }>(response);
        if (!response.ok || !data.ok) throw new Error(data.error || 'Delete failed.');
      } catch {
        failed.push(id);
      }
    }
    setSelected(new Set(failed));
    setConfirmBulk(false);
    setBulkBusy(false);
    if (failed.length) setBulkError(`${failed.length} of ${ids.length} listing${ids.length === 1 ? '' : 's'} could not be deleted.`);
    await loadListings();
    router.refresh();
  };

  const stats = useMemo(
    () => ({
      total: listings.length,
      active: listings.filter((l) => l.status === 'active').length,
      draft: listings.filter((l) => l.status === 'draft').length,
    }),
    [listings],
  );

  const allSelected = listings.length > 0 && selected.size === listings.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(listings.map((l) => l.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const syncButton = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        type="number"
        min={1}
        value={syncLimit}
        onChange={(e) => setSyncLimit(e.target.value)}
        placeholder="All"
        title="Limit to N families (leave blank to sync all)"
        style={{ width: '68px', height: '34px', padding: '0 8px', fontSize: '13px', border: '1px solid var(--admin-border)', background: 'white', color: 'var(--admin-text)', textAlign: 'center' }}
      />
      <button type="button" onClick={() => void syncCatalog()} disabled={syncing} style={btn('secondary', { disabled: syncing })}>
        {syncing ? 'Syncing…' : 'Sync Catalog'}
      </button>
    </div>
  );
  const newButton = (
    <Link href="/admin/catalog/new" style={btn('primary')}>
      + New Product
    </Link>
  );

  const familyFilterLabel = familyId ? familySkus[familyId] || familyId.slice(0, 8) : '';

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>
      <PageHeader
        title="Product Catalog"
        subtitle="All color listings — one row per color variant"
        actions={
          <>
            {syncButton}
            {newButton}
          </>
        }
      />

      {syncError ? (
        <p role="alert" style={{ ...errorText, marginBottom: '12px' }}>
          {syncError}
        </p>
      ) : null}
      {syncResult ? (
        <div role="status" style={{ margin: '0 0 16px', fontSize: '13px' }}>
          <p style={{ margin: 0, color: OK }}>
            Synced — {syncResult.families} families, {syncResult.listings} listings, {syncResult.skus} SKUs
          </p>
          {syncResult.warnings.length > 0 ? (
            <details style={{ marginTop: '6px', color: 'var(--admin-text-muted)', fontSize: '12px' }}>
              <summary style={{ cursor: 'pointer' }}>
                {syncResult.warnings.length} warning{syncResult.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {syncResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {/* Stats chips + optional family filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {loading ? (
          <span style={chip()}>Loading…</span>
        ) : (
          <>
            <span style={chip()}>
              <strong style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{stats.total}</strong> listing{stats.total === 1 ? '' : 's'}
            </span>
            <span style={chip()}>
              <strong style={{ color: OK, fontWeight: 600 }}>{stats.active}</strong> active
            </span>
            <span style={chip()}>
              <strong style={{ color: 'var(--admin-text)', fontWeight: 600 }}>{stats.draft}</strong> draft{stats.draft === 1 ? '' : 's'}
            </span>
          </>
        )}
        {familyId ? (
          <span style={{ ...chip(true), marginLeft: '4px' }}>
            Family: <span style={{ fontFamily: MONO }}>{familyFilterLabel}</span>
            <Link href="/admin/catalog" aria-label="Clear family filter" style={{ color: 'inherit', textDecoration: 'none', marginLeft: '4px' }}>
              ✕
            </Link>
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" style={{ ...errorText, marginBottom: '16px' }}>
          {error}
        </p>
      ) : null}

      {/* Bulk actions bar */}
      {selected.size > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '10px 14px',
            marginBottom: '10px',
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-gold)',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          <strong style={{ fontWeight: 600 }}>{selected.size} selected</strong>
          {confirmBulk ? (
            <>
              <span style={{ color: DANGER }}>Delete {selected.size} listing{selected.size === 1 ? '' : 's'} and all their SKUs? This cannot be undone.</span>
              <button type="button" onClick={() => void deleteSelected()} disabled={bulkBusy} style={btn('danger', { size: 'sm', disabled: bulkBusy })}>
                {bulkBusy ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" onClick={() => setConfirmBulk(false)} disabled={bulkBusy} style={btn('ghost', { size: 'sm', disabled: bulkBusy })}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmBulk(true)} style={btn('danger', { size: 'sm' })}>
                Delete selected
              </button>
              <button type="button" onClick={() => setSelected(new Set())} style={btn('ghost', { size: 'sm' })}>
                Clear
              </button>
            </>
          )}
        </div>
      ) : null}
      {bulkError ? (
        <p role="alert" style={{ ...errorText, marginBottom: '10px' }}>
          {bulkError}
        </p>
      ) : null}

      {loading ? (
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: '44px', borderRadius: '6px', background: '#EDE7DA', opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      ) : listings.length === 0 && !error ? (
        <div style={{ ...tableFrame }}>
          <EmptyState
            title={familyId ? 'No listings in this family' : 'No product listings yet'}
            description="Sync your catalog from supplier sheets or create a product manually."
            action={
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {syncButton}
                {newButton}
              </div>
            }
          />
        </div>
      ) : listings.length > 0 ? (
        <div style={tableFrame}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...th, width: '36px', paddingRight: 0 }}>
                  <input type="checkbox" aria-label="Select all listings" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <th style={{ ...th, width: '56px' }}>Image</th>
                <th style={th}>Title &amp; SKU</th>
                <th style={th}>Color</th>
                <th style={th}>Family</th>
                <th style={th}>Sizes</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => {
                const img = l.coverImage || l.images?.[0] || '';
                const checked = selected.has(l.id);
                const sizes = skuCounts[l.id] ?? 0;
                return (
                  <tr key={l.id} className="vl-row" style={checked ? { background: '#FBF6EC' } : undefined}>
                    <td style={{ ...td, paddingRight: 0 }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.title || l.listingSku}`}
                        checked={checked}
                        onChange={() => toggleOne(l.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={td}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" width={40} height={40} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: PLACEHOLDER_BG }} />
                      )}
                    </td>
                    <td style={td}>
                      <Link href={`/admin/catalog/${encodeURIComponent(l.id)}`} style={{ color: 'var(--admin-text)', textDecoration: 'none' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{l.title || '—'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontFamily: MONO, marginTop: '2px' }}>{l.listingSku}</div>
                      </Link>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span aria-hidden="true" style={swatch(l.colorCode)} />
                        {l.color || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: '12px', color: 'var(--admin-text-muted)', fontFamily: MONO }} title={l.familyId}>
                      {familySkus[l.familyId] || l.familyId.slice(0, 8) || '—'}
                    </td>
                    <td style={td}>
                      <span style={countBadge}>
                        {sizes} size{sizes === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td style={td}>
                      <StatusBadge status={l.status} size="sm" />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Link href={`/admin/catalog/${encodeURIComponent(l.id)}`} style={btn('ghost', { size: 'sm' })}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <ResetLegacySection />
    </div>
  );
}
