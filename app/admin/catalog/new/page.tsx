'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ProductFamily, ProductListing, ProductSku } from '@/lib/types';
import { STATUSES, errMsg, readJson, type CatalogStatus, type Flash } from '@/components/admin/catalog-ui';
import PageHeader from '@/components/admin/ui/PageHeader';
import SkuTable from '@/components/admin/catalog/SkuTable';
import {
  ADMIN_TABLE_CSS,
  CREAM,
  DANGER,
  INK,
  MONO,
  OK,
  PLACEHOLDER_BG,
  SANS,
  btn,
  card,
  fieldInput,
  fieldLabel,
  sectionLabel,
  swatch,
} from '@/components/admin/ui/admin-styles';

type Step = 1 | 2 | 3;

const PAGE_CSS = `
${ADMIN_TABLE_CSS}
.vl-two-col { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; align-items: start; }
@media (max-width: 900px) { .vl-two-col { grid-template-columns: minmax(0, 1fr); } }
`;

function FlashLine({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <span role={flash.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '13px', color: flash.kind === 'error' ? DANGER : OK }}>
      {flash.text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Step indicator                                                      */
/* ------------------------------------------------------------------ */

function StepIndicator({ step }: { step: Step }) {
  const labels = ['Family', 'Listing', 'SKUs'];
  return (
    <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', padding: 0, margin: '0 0 28px', maxWidth: '560px' }}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        const circle: CSSProperties = {
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 600,
          flexShrink: 0,
          background: active ? INK : done ? 'var(--admin-gold)' : 'var(--admin-surface)',
          color: active ? CREAM : done ? '#FFFFFF' : 'var(--admin-text-subtle)',
          border: `1px solid ${active ? INK : done ? 'var(--admin-gold)' : 'var(--admin-border)'}`,
        };
        return (
          <li key={label} aria-current={active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <span style={circle}>{done ? '✓' : n}</span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--admin-text)' : done ? 'var(--admin-text-muted)' : 'var(--admin-text-subtle)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </span>
            {i < labels.length - 1 ? (
              <span aria-hidden="true" style={{ flex: 1, height: '1px', margin: '0 14px', minWidth: '24px', background: done ? 'var(--admin-gold)' : 'var(--admin-border)' }} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Family                                                     */
/* ------------------------------------------------------------------ */

function FamilyStep({ onDone }: { onDone: (family: ProductFamily) => void }) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [familySku, setFamilySku] = useState('');
  const [families, setFamilies] = useState<ProductFamily[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    if (mode !== 'existing' || families !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/catalog/families', { cache: 'no-store' });
        const data = await readJson<{ families?: ProductFamily[] }>(response);
        if (!response.ok || !Array.isArray(data.families)) throw new Error(data.error || 'Could not load families.');
        if (!cancelled) {
          const sorted = [...data.families].sort((a, b) => a.familySku.localeCompare(b.familySku));
          setFamilies(sorted);
          if (sorted[0]) setSelectedId(sorted[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setFamilies([]);
          setFlash({ kind: 'error', text: errMsg(err, 'Could not load families.') });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, families]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (families ?? []).filter((f) => !q || f.familySku.toLowerCase().includes(q));
  }, [families, search]);

  const confirm = async () => {
    setFlash(null);
    if (mode === 'existing') {
      const fam = families?.find((f) => f.id === selectedId);
      if (!fam) return setFlash({ kind: 'error', text: 'Choose a family.' });
      onDone(fam);
      return;
    }
    if (!familySku.trim()) return setFlash({ kind: 'error', text: 'Family SKU is required.' });
    setBusy(true);
    try {
      const response = await fetch('/api/admin/catalog/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familySku: familySku.trim() }),
      });
      const data = await readJson<{ family?: ProductFamily }>(response);
      if (!response.ok || !data.family) throw new Error(data.error || 'Could not create family.');
      onDone(data.family);
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not create family.') });
    } finally {
      setBusy(false);
    }
  };

  const tab = (value: 'new' | 'existing'): CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${mode === value ? 'var(--admin-gold)' : 'transparent'}`,
    padding: '8px 2px',
    marginBottom: '-1px',
    fontFamily: SANS,
    fontSize: '13px',
    fontWeight: mode === value ? 600 : 500,
    color: mode === value ? 'var(--admin-text)' : 'var(--admin-text-muted)',
    cursor: busy ? 'not-allowed' : 'pointer',
  });

  return (
    <section style={{ ...card, padding: '24px', maxWidth: '560px' }}>
      <p style={{ ...sectionLabel, marginBottom: '6px' }}>Step 1</p>
      <h2 style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontWeight: 400, fontSize: '20px', margin: '0 0 6px' }}>Product family</h2>
      <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
        A family groups every color of the same design. Create a new one, or add a new color to an existing family.
      </p>
      <div role="tablist" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--admin-border-light)', marginBottom: '20px' }}>
        <button type="button" role="tab" aria-selected={mode === 'new'} disabled={busy} onClick={() => setMode('new')} style={tab('new')}>
          Create New
        </button>
        <button type="button" role="tab" aria-selected={mode === 'existing'} disabled={busy} onClick={() => setMode('existing')} style={tab('existing')}>
          Use Existing
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {mode === 'new' ? (
          <div>
            <label htmlFor="family-sku" style={fieldLabel}>
              Family SKU
            </label>
            <input
              id="family-sku"
              value={familySku}
              placeholder="e.g. VL-DRESS-001"
              disabled={busy}
              onChange={(e) => setFamilySku(e.target.value)}
              style={{ ...fieldInput, fontFamily: MONO }}
            />
          </div>
        ) : families === null ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading families…</p>
        ) : families.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>No families yet. Create a new one instead.</p>
        ) : (
          <div>
            <label htmlFor="family-search" style={fieldLabel}>
              Find family
            </label>
            <input
              id="family-search"
              value={search}
              placeholder="Search by family SKU…"
              disabled={busy}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...fieldInput, marginBottom: '8px' }}
            />
            <div
              role="listbox"
              aria-label="Existing families"
              style={{ border: '1px solid var(--admin-border)', borderRadius: '6px', maxHeight: '220px', overflowY: 'auto' }}
            >
              {filtered.length === 0 ? (
                <p style={{ margin: 0, padding: '10px 12px', fontSize: '13px', color: 'var(--admin-text-muted)' }}>No match.</p>
              ) : (
                filtered.map((f) => {
                  const sel = f.id === selectedId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => setSelectedId(f.id)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--admin-border-light)',
                        background: sel ? 'var(--admin-gold-light)' : '#FFFFFF',
                        fontFamily: MONO,
                        fontSize: '13px',
                        color: 'var(--admin-text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {f.familySku}
                      {sel ? <span style={{ color: 'var(--admin-gold)', fontFamily: SANS }}>✓</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} style={btn('primary', { disabled: busy })}>
            {busy ? 'Saving…' : mode === 'new' ? 'Create Family →' : 'Continue →'}
          </button>
          <FlashLine flash={flash} />
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Listing                                                    */
/* ------------------------------------------------------------------ */

type ListingFormState = {
  listingSku: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  color: string;
  colorCode: string;
  images: string;
  status: CatalogStatus;
};

const EMPTY_LISTING: ListingFormState = {
  listingSku: '',
  title: '',
  description: '',
  brand: 'Vellee Luxe',
  category: '',
  color: '',
  colorCode: '',
  images: '',
  status: 'draft',
};

function ListingStep({ family, onDone, onBack }: { family: ProductFamily; onDone: (listing: ProductListing) => void; onBack: () => void }) {
  const [form, setForm] = useState<ListingFormState>(() => ({ ...EMPTY_LISTING, listingSku: family.familySku ? `${family.familySku}-` : '' }));
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const set = <K extends keyof ListingFormState>(k: K, v: ListingFormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const imageList = useMemo(
    () =>
      form.images
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [form.images],
  );
  const cover = imageList[0] ?? '';

  const create = async () => {
    if (!form.listingSku.trim() || !form.title.trim()) {
      return setFlash({ kind: 'error', text: 'Listing SKU and Title are required.' });
    }
    setBusy(true);
    setFlash(null);
    try {
      const response = await fetch('/api/admin/catalog/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: family.id,
          listingSku: form.listingSku,
          title: form.title,
          description: form.description,
          brand: form.brand,
          category: form.category,
          color: form.color,
          colorCode: form.colorCode,
          status: form.status,
          images: imageList,
          coverImage: cover,
        }),
      });
      const data = await readJson<{ listing?: ProductListing }>(response);
      if (!response.ok || !data.listing) throw new Error(data.error || 'Could not create listing.');
      onDone(data.listing);
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not create listing.') });
    } finally {
      setBusy(false);
    }
  };

  const text = (key: Exclude<keyof ListingFormState, 'status' | 'images' | 'description'>, label: string, placeholder?: string, required?: boolean, extra?: CSSProperties) => (
    <div>
      <label htmlFor={`new-listing-${key}`} style={fieldLabel}>
        {label}
        {required ? <span style={{ color: DANGER }}> *</span> : null}
      </label>
      <input
        id={`new-listing-${key}`}
        value={form[key]}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => set(key, e.target.value)}
        style={{ ...fieldInput, ...extra }}
      />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
      style={{ ...card, padding: '24px' }}
    >
      <p style={{ ...sectionLabel, marginBottom: '6px' }}>Step 2</p>
      <h2 style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontWeight: 400, fontSize: '20px', margin: '0 0 6px' }}>Color listing</h2>
      <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
        Family <strong style={{ fontFamily: MONO, color: 'var(--admin-text)' }}>{family.familySku}</strong> — one listing per color.
      </p>

      <div className="vl-two-col">
        {/* Left — details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {text('listingSku', 'Listing SKU', 'e.g. VL-DRESS-001-BLK', true, { fontFamily: MONO, fontSize: '13px' })}
          {text('title', 'Title', 'e.g. Linen Wrap Dress', true)}
          <div>
            <label htmlFor="new-listing-description" style={fieldLabel}>
              Description
            </label>
            <textarea
              id="new-listing-description"
              rows={4}
              value={form.description}
              disabled={busy}
              onChange={(e) => set('description', e.target.value)}
              style={{ ...fieldInput, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {text('color', 'Color', 'e.g. Black')}
            <div>
              <label htmlFor="new-listing-colorCode" style={fieldLabel}>
                Color Code
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true" style={swatch(form.colorCode, 28)} />
                <input
                  id="new-listing-colorCode"
                  value={form.colorCode}
                  placeholder="#000000"
                  disabled={busy}
                  onChange={(e) => set('colorCode', e.target.value)}
                  style={{ ...fieldInput, fontFamily: MONO, fontSize: '13px' }}
                />
              </div>
            </div>
            {text('brand', 'Brand')}
            {text('category', 'Category', 'e.g. Dresses')}
          </div>
        </div>

        {/* Right — images + status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="new-listing-images" style={fieldLabel}>
              Images
            </label>
            <textarea
              id="new-listing-images"
              rows={5}
              value={form.images}
              placeholder={'https://…\nhttps://…'}
              disabled={busy}
              onChange={(e) => set('images', e.target.value)}
              style={{ ...fieldInput, resize: 'vertical', fontFamily: MONO, fontSize: '12px', lineHeight: 1.5 }}
            />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', margin: '6px 0 0' }}>One URL per line. The first becomes the cover.</p>
          </div>
          <div>
            <p style={{ ...fieldLabel }}>Cover preview</p>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="Cover preview" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px', display: 'block', background: PLACEHOLDER_BG }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '200px',
                  borderRadius: '6px',
                  background: PLACEHOLDER_BG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: 'var(--admin-text-subtle)',
                }}
              >
                No image yet
              </div>
            )}
          </div>
          <div>
            <label htmlFor="new-listing-status" style={fieldLabel}>
              Status
            </label>
            <select id="new-listing-status" value={form.status} disabled={busy} onChange={(e) => set('status', e.target.value as CatalogStatus)} style={fieldInput}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--admin-border-light)' }}>
        <button type="button" onClick={onBack} disabled={busy} style={btn('ghost', { disabled: busy })}>
          ← Back
        </button>
        <button type="submit" disabled={busy} style={btn('primary', { disabled: busy })}>
          {busy ? 'Creating…' : 'Create Listing →'}
        </button>
        <FlashLine flash={flash} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminNewProductPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [family, setFamily] = useState<ProductFamily | null>(null);
  const [listing, setListing] = useState<ProductListing | null>(null);
  const [skus, setSkus] = useState<ProductSku[]>([]);

  return (
    <div style={{ maxWidth: '1040px', fontFamily: SANS }}>
      <style>{PAGE_CSS}</style>
      <PageHeader
        title="New Product"
        subtitle="Create a family, add a color listing, then add sizes."
        breadcrumbs={[{ label: 'Catalog', href: '/admin/catalog' }, { label: 'New Product' }]}
        actions={
          <Link href="/admin/catalog" style={btn('secondary')}>
            Cancel
          </Link>
        }
      />
      <StepIndicator step={step} />

      {step === 1 ? (
        <FamilyStep
          onDone={(f) => {
            setFamily(f);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 && family ? (
        <ListingStep
          family={family}
          onBack={() => setStep(1)}
          onDone={(l) => {
            setListing(l);
            setStep(3);
          }}
        />
      ) : null}

      {step === 3 && listing ? (
        <section style={{ ...card, padding: '24px' }}>
          <p style={{ ...sectionLabel, marginBottom: '6px' }}>Step 3</p>
          <h2 style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontWeight: 400, fontSize: '20px', margin: '0 0 6px' }}>Sizes &amp; pricing</h2>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={swatch(listing.colorCode, 12)} />
            <strong style={{ color: 'var(--admin-text)', fontWeight: 500 }}>{listing.title}</strong>
            {listing.color ? <span>· {listing.color}</span> : null}
            <span style={{ fontFamily: MONO, fontSize: '12px' }}>({listing.listingSku})</span>
          </p>

          <SkuTable
            listingId={listing.id}
            skuPrefix={listing.listingSku}
            skus={skus}
            onUpdated={(u) => setSkus((list) => list.map((x) => (x.id === u.id ? u : x)))}
            onDeleted={(id) => setSkus((list) => list.filter((x) => x.id !== id))}
            onAdded={(s) => setSkus((list) => [...list, s])}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '20px' }}>
            <button type="button" onClick={() => router.push(`/admin/catalog/${encodeURIComponent(listing.id)}`)} style={btn('primary')}>
              Done — View Product
            </button>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)' }}>
              {skus.length} size{skus.length === 1 ? '' : 's'} added. You can add more later.
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
