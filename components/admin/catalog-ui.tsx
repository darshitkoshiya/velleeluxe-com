'use client';

/**
 * Shared styles, helpers and the "Add SKU" form for the admin catalog pages
 * (app/admin/catalog/*). Matches the inline-style conventions of the other admin pages.
 */
import { useState, type CSSProperties } from 'react';
import type { ProductSku } from '@/lib/types';

export type CatalogStatus = 'active' | 'draft' | 'archived';
export const STATUSES: CatalogStatus[] = ['active', 'draft', 'archived'];

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

/** Sort SKUs by size: XS → 3XL first, anything else alphabetically after. */
export function sortSkusBySize<T extends { size: string }>(skus: T[]): T[] {
  return [...skus].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.size.trim().toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.size.trim().toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.size.localeCompare(b.size);
  });
}

export const sectionStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '24px',
};

export const capsHeading: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
};

export const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: '15px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  background: '#fff',
  fontFamily: 'inherit',
  color: '#1C2230',
};

export const cellInputStyle: CSSProperties = {
  ...inputStyle,
  width: '80px',
  padding: '6px 8px',
  fontSize: '13px',
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6A62',
  padding: '8px 10px',
  borderBottom: '1px solid #e5e5e5',
  whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = {
  padding: '10px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '14px',
  verticalAlign: 'middle',
};

export function primaryButton(disabled: boolean): CSSProperties {
  return {
    background: '#1C2230',
    color: '#F6F1E8',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    display: 'inline-block',
  };
}

export function smallButton(disabled: boolean): CSSProperties {
  return {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '7px 12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
    textDecoration: 'none',
    display: 'inline-block',
  };
}

export const dangerButton = (disabled: boolean): CSSProperties => ({
  ...smallButton(disabled),
  background: '#9A3B1E',
  color: '#fff',
  border: '1px solid #9A3B1E',
});

export async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export type Flash = { kind: 'ok' | 'error'; text: string } | null;

export function FlashText({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <span
      role={flash.kind === 'error' ? 'alert' : 'status'}
      style={{ fontSize: '13px', color: flash.kind === 'error' ? '#9A3B1E' : '#1E6B45' }}
    >
      {flash.text}
    </span>
  );
}

const STATUS_COLORS: Record<CatalogStatus, { bg: string; fg: string }> = {
  active: { bg: '#E3F1E8', fg: '#1E6B45' },
  draft: { bg: '#FBF1D6', fg: '#8A6410' },
  archived: { bg: '#ECECEC', fg: '#6F6A62' },
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status as CatalogStatus] ?? STATUS_COLORS.archived;
  return (
    <span
      style={{
        display: 'inline-block',
        background: c.bg,
        color: c.fg,
        borderRadius: '999px',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

export function ColorSwatch({ colorCode, size = 14 }: { colorCode?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        border: '1px solid #ccc',
        background: colorCode?.trim() ? colorCode.trim() : 'repeating-linear-gradient(45deg,#eee,#eee 3px,#fff 3px,#fff 6px)',
        flexShrink: 0,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Add SKU form                                                        */
/* ------------------------------------------------------------------ */

type SkuFormState = {
  sku: string;
  sizeChoice: string; // one of SIZE_ORDER or 'Other'
  sizeOther: string;
  supplierPrice: string;
  markup: string;
  mrp: string;
  stockQuantity: string;
  barcode: string;
  status: CatalogStatus;
};

const EMPTY_SKU_FORM: SkuFormState = {
  sku: '',
  sizeChoice: 'M',
  sizeOther: '',
  supplierPrice: '',
  markup: '',
  mrp: '',
  stockQuantity: '0',
  barcode: '',
  status: 'active',
};

function toNum(text: string): number {
  const t = text.trim();
  return t === '' ? NaN : Number(t);
}

/** Form that POSTs a new SKU to /api/admin/catalog/listings/[listingId]/skus. */
export function AddSkuForm({ listingId, onAdded }: { listingId: string; onAdded: (sku: ProductSku) => void }) {
  const [form, setForm] = useState<SkuFormState>(EMPTY_SKU_FORM);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const set = <K extends keyof SkuFormState>(key: K, value: SkuFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const supplierPrice = toNum(form.supplierPrice);
  const markup = toNum(form.markup);
  const selling =
    Number.isFinite(supplierPrice) && Number.isFinite(markup) ? supplierPrice + markup : null;

  const submit = async () => {
    const size = form.sizeChoice === 'Other' ? form.sizeOther.trim() : form.sizeChoice;
    const mrp = toNum(form.mrp);
    const stock = form.stockQuantity.trim() === '' ? 0 : Number(form.stockQuantity);
    if (!form.sku.trim()) return setFlash({ kind: 'error', text: 'SKU is required.' });
    if (!size) return setFlash({ kind: 'error', text: 'Size is required.' });
    if (!Number.isFinite(supplierPrice) || supplierPrice < 0)
      return setFlash({ kind: 'error', text: 'Supplier price must be 0 or more.' });
    if (!Number.isInteger(markup) || markup < 0)
      return setFlash({ kind: 'error', text: 'Markup must be a whole number of 0 or more.' });
    if (!Number.isFinite(mrp) || mrp < 0) return setFlash({ kind: 'error', text: 'MRP must be 0 or more.' });
    if (!Number.isInteger(stock) || stock < 0)
      return setFlash({ kind: 'error', text: 'Stock must be a whole number of 0 or more.' });

    setSaving(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(listingId)}/skus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim(),
          size,
          supplierPrice,
          markup,
          mrp,
          stockQuantity: stock,
          barcode: form.barcode.trim(),
          status: form.status,
        }),
      });
      const data = await readJson<{ sku?: ProductSku }>(response);
      if (!response.ok || !data.sku) throw new Error(data.error || 'Could not add SKU.');
      onAdded(data.sku);
      setForm(EMPTY_SKU_FORM);
      setFlash({ kind: 'ok', text: `Added ${data.sku.sku}.` });
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not add SKU.') });
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, child: React.ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={{ ...labelStyle, fontSize: '13px' }}>
        {label}
      </label>
      {child}
    </div>
  );

  const small: CSSProperties = { ...inputStyle, padding: '8px 10px', fontSize: '14px' };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        {field(
          'new-sku-sku',
          'SKU *',
          <input id="new-sku-sku" value={form.sku} disabled={saving} onChange={(e) => set('sku', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-size',
          'Size *',
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <select
              id="new-sku-size"
              value={form.sizeChoice}
              disabled={saving}
              onChange={(e) => set('sizeChoice', e.target.value)}
              style={small}
            >
              {SIZE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Other">Other…</option>
            </select>
            {form.sizeChoice === 'Other' ? (
              <input
                aria-label="Custom size"
                placeholder="e.g. Free Size"
                value={form.sizeOther}
                disabled={saving}
                onChange={(e) => set('sizeOther', e.target.value)}
                style={small}
              />
            ) : null}
          </div>,
        )}
        {field(
          'new-sku-supplier',
          'Supplier ₹ *',
          <input id="new-sku-supplier" type="number" min={0} step="any" value={form.supplierPrice} disabled={saving} onChange={(e) => set('supplierPrice', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-markup',
          'Markup ₹ *',
          <input id="new-sku-markup" type="number" min={0} step={1} value={form.markup} disabled={saving} onChange={(e) => set('markup', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-mrp',
          'MRP ₹ *',
          <input id="new-sku-mrp" type="number" min={0} step="any" value={form.mrp} disabled={saving} onChange={(e) => set('mrp', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-stock',
          'Stock',
          <input id="new-sku-stock" type="number" min={0} step={1} value={form.stockQuantity} disabled={saving} onChange={(e) => set('stockQuantity', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-barcode',
          'Barcode',
          <input id="new-sku-barcode" value={form.barcode} disabled={saving} onChange={(e) => set('barcode', e.target.value)} style={small} />,
        )}
        {field(
          'new-sku-status',
          'Status',
          <select id="new-sku-status" value={form.status} disabled={saving} onChange={(e) => set('status', e.target.value as CatalogStatus)} style={small}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>,
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', color: '#6F6A62' }}>
          Selling price: <strong style={{ color: '#1C2230' }}>{selling === null ? '—' : `₹${selling}`}</strong>
        </span>
        <button type="submit" disabled={saving} style={primaryButton(saving)}>
          {saving ? 'Adding…' : 'Add SKU'}
        </button>
        <FlashText flash={flash} />
      </div>
    </form>
  );
}
