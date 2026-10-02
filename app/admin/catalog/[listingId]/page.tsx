'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AdminListingDetail, ProductListing, ProductSku } from '@/lib/types';
import { STATUSES, errMsg, readJson, type CatalogStatus, type Flash } from '@/components/admin/catalog-ui';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import SkuTable from '@/components/admin/catalog/SkuTable';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  DANGER_BG,
  DANGER_BORDER,
  MONO,
  OK,
  PLACEHOLDER_BG,
  SANS,
  SERIF,
  btn,
  card,
  countBadge,
  errorText,
  fieldInput,
  fieldLabel,
  sectionLabel,
  swatch,
} from '@/components/admin/ui/admin-styles';

const PAGE_CSS = `
${ADMIN_TABLE_CSS}
.vl-detail-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; align-items: start; }
@media (max-width: 1100px) { .vl-detail-grid { grid-template-columns: minmax(0, 1fr); } }
.vl-color-link:hover { background: #FDFAF6; }
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function parseImages(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Listing edit form (left column: images + product info)              */
/* ------------------------------------------------------------------ */

type ListingForm = {
  title: string;
  description: string;
  brand: string;
  category: string;
  color: string;
  colorCode: string;
  listingSku: string;
  status: CatalogStatus;
  images: string;
  coverImage: string;
};

function toForm(l: ProductListing): ListingForm {
  return {
    title: l.title,
    description: l.description,
    brand: l.brand,
    category: l.category,
    color: l.color,
    colorCode: l.colorCode,
    listingSku: l.listingSku,
    status: l.status,
    images: (l.images ?? []).join('\n'),
    coverImage: l.coverImage,
  };
}

function ListingEditForm({ listing, onSaved }: { listing: ProductListing; onSaved: (l: ProductListing) => void }) {
  const [form, setForm] = useState<ListingForm>(() => toForm(listing));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    setForm(toForm(listing));
  }, [listing]);

  useEffect(() => {
    if (!flash || flash.kind === 'error') return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const set = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const imageList = useMemo(() => parseImages(form.images), [form.images]);
  const gallery = useMemo(() => {
    const all = form.coverImage.trim() ? [form.coverImage.trim(), ...imageList] : imageList;
    return Array.from(new Set(all));
  }, [form.coverImage, imageList]);
  const cover = form.coverImage.trim() || imageList[0] || '';

  const save = async () => {
    setSaving(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(listing.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          brand: form.brand,
          category: form.category,
          color: form.color,
          colorCode: form.colorCode,
          listingSku: form.listingSku,
          status: form.status,
          images: imageList,
          coverImage: form.coverImage,
        }),
      });
      const data = await readJson<{ listing?: ProductListing }>(response);
      if (!response.ok || !data.listing) throw new Error(data.error || 'Could not save listing.');
      onSaved(data.listing);
      setFlash({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not save listing.') });
    } finally {
      setSaving(false);
    }
  };

  const text = (key: keyof ListingForm, label: string, placeholder?: string, extra?: CSSProperties) => (
    <div>
      <label htmlFor={`listing-${key}`} style={fieldLabel}>
        {label}
      </label>
      <input
        id={`listing-${key}`}
        value={form[key]}
        placeholder={placeholder}
        disabled={saving}
        onChange={(e) => set(key, e.target.value as never)}
        style={{ ...fieldInput, ...extra }}
      />
    </div>
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(listing));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      style={{ ...card, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* Images */}
      <div>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={form.title || 'Cover image'}
            style={{ width: '100%', maxHeight: '280px', height: '280px', objectFit: 'cover', borderRadius: '6px', display: 'block', background: PLACEHOLDER_BG }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '280px',
              borderRadius: '6px',
              background: PLACEHOLDER_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--admin-text-subtle)',
            }}
          >
            No image yet — add image URLs below
          </div>
        )}
        {gallery.length > 1 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {gallery.map((url) => {
              const isCover = url === cover;
              return (
                <button
                  key={url}
                  type="button"
                  className="vl-thumb"
                  title={isCover ? 'Current cover' : 'Make cover image'}
                  aria-label={isCover ? 'Current cover image' : 'Make this the cover image'}
                  aria-pressed={isCover}
                  onClick={() => set('coverImage', url)}
                  disabled={saving}
                  style={{
                    padding: 0,
                    width: '48px',
                    height: '48px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: isCover ? '2px solid var(--admin-gold)' : '1px solid var(--admin-border)',
                    background: PLACEHOLDER_BG,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Product information */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <p style={sectionLabel}>Product Information</p>
        <span style={{ flex: 1, height: '1px', background: 'var(--admin-border-light)' }} />
      </div>

      {text('title', 'Title', undefined, { fontFamily: SERIF, fontSize: '20px', padding: '10px 12px' })}

      <div>
        <label htmlFor="listing-description" style={fieldLabel}>
          Description
        </label>
        <textarea
          id="listing-description"
          rows={4}
          value={form.description}
          disabled={saving}
          onChange={(e) => set('description', e.target.value)}
          style={{ ...fieldInput, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {text('brand', 'Brand')}
        {text('category', 'Category')}
        {text('color', 'Color', 'e.g. Black')}
        <div>
          <label htmlFor="listing-colorCode" style={fieldLabel}>
            Color Code
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true" style={swatch(form.colorCode, 28)} />
            <input
              id="listing-colorCode"
              value={form.colorCode}
              placeholder="#000000"
              disabled={saving}
              onChange={(e) => set('colorCode', e.target.value)}
              style={{ ...fieldInput, fontFamily: MONO, fontSize: '13px' }}
            />
          </div>
        </div>
        {text('listingSku', 'Listing SKU', undefined, { fontFamily: MONO, fontSize: '13px' })}
        <div>
          <label htmlFor="listing-status" style={fieldLabel}>
            Status
          </label>
          <select id="listing-status" value={form.status} disabled={saving} onChange={(e) => set('status', e.target.value as CatalogStatus)} style={fieldInput}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="listing-images" style={fieldLabel}>
          Images
        </label>
        <textarea
          id="listing-images"
          rows={4}
          value={form.images}
          placeholder={'https://…\nhttps://…'}
          disabled={saving}
          onChange={(e) => set('images', e.target.value)}
          style={{ ...fieldInput, resize: 'vertical', fontSize: '12px', fontFamily: MONO, lineHeight: 1.5 }}
        />
        <p style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', margin: '6px 0 0' }}>
          One URL per line (or comma-separated). Click a thumbnail above to make it the cover.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px', borderTop: '1px solid var(--admin-border-light)' }}>
        <button type="submit" disabled={saving} style={{ ...btn('primary', { disabled: saving }), marginTop: '16px' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {dirty && !saving && !flash ? <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', marginTop: '16px' }}>Unsaved changes</span> : null}
        {flash ? (
          <span role={flash.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '13px', marginTop: '16px', color: flash.kind === 'error' ? DANGER : OK }}>
            {flash.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const skeleton: CSSProperties = { background: '#EDE7DA', borderRadius: '8px' };

export default function AdminListingDetailPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = decodeURIComponent(String(params?.listingId ?? ''));
  const router = useRouter();

  const [detail, setDetail] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(listingId)}`, { cache: 'no-store' });
        const data = await readJson<{ detail?: AdminListingDetail }>(response);
        if (!response.ok || !data.detail) throw new Error(data.error || 'Could not load listing.');
        if (!cancelled) setDetail(data.detail);
      } catch (err) {
        if (!cancelled) setError(errMsg(err, 'Could not load listing.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const setSkus = (fn: (skus: ProductSku[]) => ProductSku[]) => setDetail((d) => (d ? { ...d, skus: fn(d.skus) } : d));

  const deleteListing = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(listingId)}`, { method: 'DELETE' });
      const data = await readJson<{ ok?: boolean }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete listing.');
      router.push('/admin/catalog');
      router.refresh();
    } catch (err) {
      setDeleteError(errMsg(err, 'Could not delete listing.'));
      setDeleting(false);
    }
  };

  const breadcrumbs = [{ label: 'Catalog', href: '/admin/catalog' }, { label: detail?.listing.title || detail?.listing.listingSku || 'Listing' }];

  if (loading) {
    return (
      <div aria-busy="true" style={{ fontFamily: SANS }}>
        <div style={{ ...skeleton, height: '14px', width: '160px', marginBottom: '14px' }} />
        <div style={{ ...skeleton, height: '32px', width: '320px', marginBottom: '28px' }} />
        <div className="vl-detail-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
          <div style={{ ...skeleton, height: '520px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ ...skeleton, height: '80px' }} />
            <div style={{ ...skeleton, height: '140px' }} />
            <div style={{ ...skeleton, height: '220px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ fontFamily: SANS }}>
        <PageHeader title="Listing" breadcrumbs={breadcrumbs} />
        <p role="alert" style={errorText}>
          {error || 'Listing not found.'}
        </p>
      </div>
    );
  }

  const { listing, family, siblings } = detail;
  const colorOptions = [listing, ...siblings.filter((s) => s.id !== listing.id)];

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{PAGE_CSS}</style>
      <PageHeader
        title={listing.title || listing.listingSku}
        subtitle={[listing.color, listing.listingSku].filter(Boolean).join(' · ')}
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <StatusBadge status={listing.status} />
            <Link href="/admin/catalog" style={btn('secondary')}>
              ← Back to catalog
            </Link>
          </>
        }
      />

      <div className="vl-detail-grid">
        {/* LEFT — images + info form */}
        <ListingEditForm listing={listing} onSaved={(l) => setDetail((d) => (d ? { ...d, listing: l } : d))} />

        {/* RIGHT — family, colors, SKUs, danger zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Family card */}
          <section style={card}>
            <p style={{ ...sectionLabel, marginBottom: '8px' }}>Product Family</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                href={`/admin/catalog?familyId=${encodeURIComponent(family.id)}`}
                style={{ fontFamily: MONO, fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)', textDecoration: 'none' }}
                title="View all listings in this family"
              >
                {family.familySku || family.id.slice(0, 12)}
              </Link>
              <span style={countBadge}>
                {colorOptions.length} color{colorOptions.length === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          {/* Color switcher */}
          <section style={card}>
            <p style={{ ...sectionLabel, marginBottom: '10px' }}>Colors ({colorOptions.length})</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {colorOptions.map((l) => {
                const selected = l.id === listing.id;
                const row: CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  color: 'var(--admin-text)',
                  border: selected ? '1px solid var(--admin-gold)' : '1px solid transparent',
                  background: selected ? 'var(--admin-gold-light)' : 'transparent',
                  fontWeight: selected ? 600 : 400,
                };
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        ...swatch(l.colorCode, 14),
                        boxShadow: selected ? '0 0 0 2px #fff, 0 0 0 3px var(--admin-gold)' : undefined,
                      }}
                    />
                    <span style={{ flex: 1 }}>{l.color || l.listingSku}</span>
                    {selected ? (
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontWeight: 400 }}>current</span>
                    ) : (
                      <StatusBadge status={l.status} size="sm" />
                    )}
                  </>
                );
                return (
                  <li key={l.id}>
                    {selected ? (
                      <span style={row} aria-current="page">
                        {content}
                      </span>
                    ) : (
                      <Link href={`/admin/catalog/${encodeURIComponent(l.id)}`} className="vl-color-link" style={row}>
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Sizes & pricing */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <p style={sectionLabel}>Sizes &amp; Pricing ({detail.skus.length})</p>
              <button
                type="button"
                onClick={() => document.querySelector<HTMLSelectElement>('select[aria-label="New size"]')?.focus()}
                style={btn('secondary', { size: 'sm' })}
              >
                + Add Size
              </button>
            </div>
            <SkuTable
              listingId={listing.id}
              skuPrefix={listing.listingSku}
              skus={detail.skus}
              onUpdated={(u) => setSkus((list) => list.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => setSkus((list) => list.filter((x) => x.id !== id))}
              onAdded={(s) => setSkus((list) => [...list, s])}
            />
          </section>

          {/* Danger zone */}
          <section style={{ ...card, borderColor: DANGER_BORDER, background: '#FBF4F1' }}>
            <p style={{ ...sectionLabel, color: DANGER, marginBottom: '10px' }}>Danger Zone</p>
            {confirmDelete ? (
              <div role="alertdialog" aria-label="Confirm delete listing" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: DANGER, background: DANGER_BG, padding: '10px 12px', borderRadius: '6px' }}>
                  Delete this listing and all {detail.skus.length} SKU{detail.skus.length === 1 ? '' : 's'}? This cannot be undone.
                </span>
                <span style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => void deleteListing()} disabled={deleting} style={btn('danger', { size: 'sm', disabled: deleting })}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} style={btn('ghost', { size: 'sm', disabled: deleting })}>
                    Cancel
                  </button>
                </span>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} style={btn('dangerOutline', { size: 'sm' })}>
                Delete this listing and all its SKUs
              </button>
            )}
            {deleteError ? (
              <p role="alert" style={{ ...errorText, marginTop: '10px' }}>
                {deleteError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
