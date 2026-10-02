'use client';

/**
 * Editable "Sizes & Pricing" table for one listing. Used by the listing detail page
 * and step 3 of the new-product flow.
 *
 *  - Inline editing of supplier price, markup, MRP and stock; "Save" appears when a row changes.
 *  - SP (selling price) = supplier price + markup, computed and read-only.
 *  - ✕ deletes a SKU after an inline confirmation.
 *  - The last row is an inline "add size" form.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { ProductSku } from '@/lib/types';
import { SIZE_ORDER, errMsg, readJson, sortSkusBySize, type Flash } from '@/components/admin/catalog-ui';
import { DANGER, MONO, OK, WARN, btn, cellInput, tableFrame, tableStyle, td, th } from '@/components/admin/ui/admin-styles';

type NumKey = 'supplierPrice' | 'markup' | 'mrp' | 'stockQuantity';
type RowState = Record<NumKey, string>;

function rowFrom(s: ProductSku): RowState {
  return {
    supplierPrice: String(s.supplierPrice),
    markup: String(s.markup),
    mrp: String(s.mrp),
    stockQuantity: String(s.stockQuantity),
  };
}

function toNum(text: string): number {
  const t = text.trim();
  return t === '' ? NaN : Number(t);
}

function computeSp(supplier: string, markup: string): number | null {
  const a = toNum(supplier);
  const b = toNum(markup);
  return Number.isFinite(a) && Number.isFinite(b) ? a + b : null;
}

/** Stock text colour: red ≤5, orange ≤10. */
function stockColor(text: string): string {
  const n = toNum(text);
  if (!Number.isFinite(n)) return 'var(--admin-text)';
  if (n <= 5) return DANGER;
  if (n <= 10) return WARN;
  return 'var(--admin-text)';
}

const tdTight: CSSProperties = { ...td, padding: '6px 8px', whiteSpace: 'nowrap' };
const thTight: CSSProperties = { ...th, padding: '9px 8px' };

const NUM_FIELDS: { key: NumKey; integer: boolean; label: string; step: string | number }[] = [
  { key: 'supplierPrice', integer: false, label: 'Supplier price', step: 'any' },
  { key: 'markup', integer: true, label: 'Markup', step: 1 },
  { key: 'mrp', integer: false, label: 'MRP', step: 'any' },
  { key: 'stockQuantity', integer: true, label: 'Stock', step: 1 },
];

/* ------------------------------------------------------------------ */
/* Existing SKU row                                                    */
/* ------------------------------------------------------------------ */

function SkuRow({ sku, onUpdated, onDeleted }: { sku: ProductSku; onUpdated: (s: ProductSku) => void; onDeleted: (id: string) => void }) {
  const [row, setRow] = useState<RowState>(() => rowFrom(sku));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    setRow(rowFrom(sku));
  }, [sku]);

  useEffect(() => {
    if (!flash || flash.kind === 'error') return;
    const t = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(t);
  }, [flash]);

  const changes = (): Record<string, number> | string => {
    const out: Record<string, number> = {};
    for (const f of NUM_FIELDS) {
      const n = toNum(row[f.key]);
      if (!Number.isFinite(n) || n < 0 || (f.integer && !Number.isInteger(n))) {
        return `${f.label} must be ${f.integer ? 'a whole number' : 'a number'} of 0 or more.`;
      }
      if (n !== sku[f.key]) out[f.key] = n;
    }
    return out;
  };

  const pending = changes();
  const dirty = typeof pending === 'string' || Object.keys(pending).length > 0;

  const save = async () => {
    const body = changes();
    if (typeof body === 'string') return setFlash({ kind: 'error', text: body });
    if (Object.keys(body).length === 0) return;
    setBusy(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/catalog/skus/${encodeURIComponent(sku.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJson<{ sku?: ProductSku }>(response);
      if (!response.ok || !data.sku) throw new Error(data.error || 'Could not save SKU.');
      onUpdated(data.sku);
      setFlash({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not save SKU.') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/catalog/skus/${encodeURIComponent(sku.id)}`, { method: 'DELETE' });
      const data = await readJson<{ ok?: boolean }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete SKU.');
      onDeleted(sku.id);
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not delete SKU.') });
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const sp = computeSp(row.supplierPrice, row.markup);

  const numInput = (key: NumKey, step: string | number, extra?: CSSProperties) => (
    <input
      type="number"
      min={0}
      step={step}
      aria-label={`${key} for ${sku.sku}`}
      value={row[key]}
      disabled={busy}
      onChange={(e) => setRow((r) => ({ ...r, [key]: e.target.value }))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void save();
        }
      }}
      style={{ ...cellInput, ...extra }}
    />
  );

  return (
    <>
      <tr className="vl-row" style={dirty ? { background: '#FBF6EC' } : undefined}>
        <td style={{ ...tdTight, fontWeight: 600 }}>{sku.size}</td>
        <td style={{ ...tdTight, fontFamily: MONO, fontSize: '11px', color: 'var(--admin-text-muted)' }}>{sku.sku}</td>
        <td style={tdTight}>{numInput('supplierPrice', 'any')}</td>
        <td style={tdTight}>{numInput('markup', 1)}</td>
        <td style={tdTight}>{numInput('mrp', 'any')}</td>
        <td style={{ ...tdTight, fontWeight: 500 }} title="Supplier price + markup">
          {sp === null ? '—' : `₹${sp}`}
        </td>
        <td style={tdTight}>{numInput('stockQuantity', 1, { width: '60px', color: stockColor(row.stockQuantity), fontWeight: 600 })}</td>
        <td style={{ ...tdTight, textAlign: 'right' }}>
          <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            {dirty && !confirmDelete ? (
              <button type="button" onClick={() => void save()} disabled={busy} style={btn('primary', { size: 'sm', disabled: busy })}>
                {busy ? '…' : 'Save'}
              </button>
            ) : null}
            {confirmDelete ? (
              <>
                <button type="button" onClick={() => void remove()} disabled={busy} style={btn('danger', { size: 'sm', disabled: busy })}>
                  {busy ? '…' : 'Delete'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} style={btn('ghost', { size: 'sm', disabled: busy })}>
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label={`Delete ${sku.sku}`}
                title="Delete size"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                style={{ ...btn('ghost', { size: 'sm', disabled: busy }), padding: '4px 8px', color: DANGER, borderColor: 'transparent' }}
              >
                ✕
              </button>
            )}
          </span>
        </td>
      </tr>
      {flash ? (
        <tr>
          <td colSpan={8} style={{ ...tdTight, height: 'auto', paddingTop: '4px', paddingBottom: '6px' }}>
            <span role={flash.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '12px', color: flash.kind === 'error' ? DANGER : OK }}>
              {flash.text}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline add row                                                      */
/* ------------------------------------------------------------------ */

type AddState = { sizeChoice: string; sizeOther: string; sku: string } & RowState;

function emptyAdd(skuPrefix: string, taken: string[]): AddState {
  const nextSize = SIZE_ORDER.find((s) => !taken.includes(s)) ?? 'Other';
  return {
    sizeChoice: nextSize,
    sizeOther: '',
    sku: skuPrefix && nextSize !== 'Other' ? `${skuPrefix}-${nextSize}` : '',
    supplierPrice: '',
    markup: '',
    mrp: '',
    stockQuantity: '0',
  };
}

function AddSkuRow({
  listingId,
  skuPrefix,
  takenSizes,
  onAdded,
}: {
  listingId: string;
  skuPrefix: string;
  takenSizes: string[];
  onAdded: (s: ProductSku) => void;
}) {
  const [form, setForm] = useState<AddState>(() => emptyAdd(skuPrefix, takenSizes));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [skuTouched, setSkuTouched] = useState(false);

  useEffect(() => {
    if (!flash || flash.kind === 'error') return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const setSize = (choice: string) =>
    setForm((f) => ({
      ...f,
      sizeChoice: choice,
      sku: !skuTouched && skuPrefix && choice !== 'Other' ? `${skuPrefix}-${choice}` : f.sku,
    }));

  const submit = async () => {
    const size = form.sizeChoice === 'Other' ? form.sizeOther.trim() : form.sizeChoice;
    const supplierPrice = toNum(form.supplierPrice);
    const markup = toNum(form.markup);
    const mrp = toNum(form.mrp);
    const stock = form.stockQuantity.trim() === '' ? 0 : Number(form.stockQuantity);
    if (!size) return setFlash({ kind: 'error', text: 'Size is required.' });
    if (!form.sku.trim()) return setFlash({ kind: 'error', text: 'SKU is required.' });
    if (!Number.isFinite(supplierPrice) || supplierPrice < 0) return setFlash({ kind: 'error', text: 'Supplier price must be 0 or more.' });
    if (!Number.isInteger(markup) || markup < 0) return setFlash({ kind: 'error', text: 'Markup must be a whole number of 0 or more.' });
    if (!Number.isFinite(mrp) || mrp < 0) return setFlash({ kind: 'error', text: 'MRP must be 0 or more.' });
    if (!Number.isInteger(stock) || stock < 0) return setFlash({ kind: 'error', text: 'Stock must be a whole number of 0 or more.' });

    setSaving(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/catalog/listings/${encodeURIComponent(listingId)}/skus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: form.sku.trim(), size, supplierPrice, markup, mrp, stockQuantity: stock, barcode: '', status: 'active' }),
      });
      const data = await readJson<{ sku?: ProductSku }>(response);
      if (!response.ok || !data.sku) throw new Error(data.error || 'Could not add size.');
      onAdded(data.sku);
      // Keep prices for the next size (usually identical), advance the size.
      const taken = [...takenSizes, data.sku.size.toUpperCase()];
      const next = emptyAdd(skuPrefix, taken);
      setForm({ ...next, supplierPrice: form.supplierPrice, markup: form.markup, mrp: form.mrp });
      setSkuTouched(false);
      setFlash({ kind: 'ok', text: `Added ${data.sku.size}.` });
    } catch (err) {
      setFlash({ kind: 'error', text: errMsg(err, 'Could not add size.') });
    } finally {
      setSaving(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  const num = (key: NumKey, step: string | number, label: string, width = '70px') => (
    <input
      type="number"
      min={0}
      step={step}
      aria-label={`New size ${label}`}
      placeholder="0"
      value={form[key]}
      disabled={saving}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      onKeyDown={onEnter}
      style={{ ...cellInput, width }}
    />
  );

  const sp = computeSp(form.supplierPrice, form.markup);
  const addBg = '#FCFAF6';

  return (
    <>
      <tr style={{ background: addBg }}>
        <td style={tdTight}>
          <select
            aria-label="New size"
            value={form.sizeChoice}
            disabled={saving}
            onChange={(e) => setSize(e.target.value)}
            style={{ ...cellInput, width: '64px' }}
          >
            {SIZE_ORDER.map((s) => (
              <option key={s} value={s} disabled={takenSizes.includes(s)}>
                {s}
              </option>
            ))}
            <option value="Other">Other…</option>
          </select>
          {form.sizeChoice === 'Other' ? (
            <input
              aria-label="Custom size"
              placeholder="Free Size"
              value={form.sizeOther}
              disabled={saving}
              onChange={(e) => setForm((f) => ({ ...f, sizeOther: e.target.value }))}
              onKeyDown={onEnter}
              style={{ ...cellInput, width: '80px', marginTop: '4px', display: 'block' }}
            />
          ) : null}
        </td>
        <td style={tdTight}>
          <input
            aria-label="New SKU code"
            placeholder="SKU"
            value={form.sku}
            disabled={saving}
            onChange={(e) => {
              setSkuTouched(true);
              setForm((f) => ({ ...f, sku: e.target.value }));
            }}
            onKeyDown={onEnter}
            style={{ ...cellInput, width: '120px', fontFamily: MONO, fontSize: '11px' }}
          />
        </td>
        <td style={tdTight}>{num('supplierPrice', 'any', 'supplier price')}</td>
        <td style={tdTight}>{num('markup', 1, 'markup')}</td>
        <td style={tdTight}>{num('mrp', 'any', 'MRP')}</td>
        <td style={{ ...tdTight, color: 'var(--admin-text-muted)' }}>{sp === null ? '—' : `₹${sp}`}</td>
        <td style={tdTight}>{num('stockQuantity', 1, 'stock', '60px')}</td>
        <td style={{ ...tdTight, textAlign: 'right' }}>
          <button type="button" onClick={() => void submit()} disabled={saving} style={btn('secondary', { size: 'sm', disabled: saving })}>
            {saving ? '…' : 'Add'}
          </button>
        </td>
      </tr>
      {flash ? (
        <tr style={{ background: addBg }}>
          <td colSpan={8} style={{ ...tdTight, height: 'auto', paddingTop: '2px', paddingBottom: '8px' }}>
            <span role={flash.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '12px', color: flash.kind === 'error' ? DANGER : OK }}>
              {flash.text}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export default function SkuTable({
  listingId,
  skuPrefix = '',
  skus,
  onUpdated,
  onDeleted,
  onAdded,
}: {
  listingId: string;
  /** Prefix used to suggest new SKU codes, e.g. the listing SKU ("VL-TEE-001-BLK" -> "VL-TEE-001-BLK-M"). */
  skuPrefix?: string;
  skus: ProductSku[];
  onUpdated: (s: ProductSku) => void;
  onDeleted: (id: string) => void;
  onAdded: (s: ProductSku) => void;
}) {
  const sorted = sortSkusBySize(skus);
  const takenSizes = sorted.map((s) => s.size.trim().toUpperCase());

  return (
    <div style={tableFrame}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thTight}>Size</th>
            <th style={thTight}>SKU</th>
            <th style={thTight}>Supplier ₹</th>
            <th style={thTight}>Markup ₹</th>
            <th style={thTight}>MRP ₹</th>
            <th style={thTight} title="Selling price = supplier + markup">
              SP ₹
            </th>
            <th style={thTight}>Stock</th>
            <th style={{ ...thTight, textAlign: 'right' }}>Del</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ ...tdTight, color: 'var(--admin-text-muted)', fontSize: '12px' }}>
                No sizes yet — add the first one below.
              </td>
            </tr>
          ) : (
            sorted.map((s) => <SkuRow key={s.id} sku={s} onUpdated={onUpdated} onDeleted={onDeleted} />)
          )}
          <AddSkuRow listingId={listingId} skuPrefix={skuPrefix} takenSizes={takenSizes} onAdded={onAdded} />
        </tbody>
      </table>
    </div>
  );
}
