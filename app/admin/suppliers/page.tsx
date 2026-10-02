'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import PageHeader from '@/components/admin/ui/PageHeader';
import EmptyState from '@/components/admin/ui/EmptyState';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import {
  ADMIN_FORM_CSS,
  DANGER,
  DANGER_BG,
  MONO,
  OK,
  SANS,
  SERIF,
  button,
  fieldLabel,
  hint,
  input,
  sectionCard,
  sectionTitle,
  subLabel,
} from '@/components/admin/ui/form-styles';

/** Mirrors Supplier in lib/suppliers.ts (that file is server-only, so it can't be imported here). */
type Supplier = {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetTab: string;
  driveFolderId: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  margin: number;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  spreadsheetId: string;
  sheetTab: string;
  driveFolderId: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  /** Kept as text while typing; converted to a whole number on save. */
  margin: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  spreadsheetId: '',
  sheetTab: 'Products',
  driveFolderId: '',
  contactName: '',
  contactPhone: '',
  notes: '',
  margin: '0',
};

/** null = form closed, 'new' = adding, otherwise the id being edited. */
type Editing = null | 'new' | string;

function sheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`;
}

function driveUrl(driveFolderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(driveFolderId)}`;
}

/** Accepts a bare spreadsheet ID or a full Google Sheets URL and returns just the ID. */
function extractSpreadsheetId(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
function timeAgo(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const rowLabel: CSSProperties = {
  width: '72px',
  flexShrink: 0,
  fontFamily: SANS,
  fontSize: '12px',
  color: 'var(--admin-text-muted)',
};

function FlashText({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <span
      role={flash.kind === 'error' ? 'alert' : 'status'}
      style={{ fontFamily: SANS, fontSize: '12px', color: flash.kind === 'error' ? DANGER : OK }}
    >
      {flash.text}
    </span>
  );
}

/** Auto-clears an "ok" flash after a short delay. */
function useFlash(): [Flash, (flash: Flash) => void] {
  const [flash, setFlash] = useState<Flash>(null);
  useEffect(() => {
    if (!flash || flash.kind === 'error') return;
    const timer = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(timer);
  }, [flash]);
  return [flash, setFlash];
}

/** Inline markup input for one supplier card. */
function SupplierPricingControls({
  supplier,
  disabled,
  onMarginSaved,
}: {
  supplier: Supplier;
  disabled: boolean;
  onMarginSaved: (id: string, margin: number) => void;
}) {
  const [value, setValue] = useState(String(supplier.margin ?? 0));
  const [savingMargin, setSavingMargin] = useState(false);
  const [flash, setFlash] = useFlash();

  useEffect(() => {
    setValue(String(supplier.margin ?? 0));
  }, [supplier.margin]);

  const saveMargin = async () => {
    const text = value.trim();
    const next = text === '' ? 0 : Number(text);
    if (next === supplier.margin) {
      setValue(String(supplier.margin ?? 0));
      return;
    }
    if (!/^\d+$/.test(text || '0') || !Number.isInteger(next) || next < 0 || next > 100000) {
      setFlash({ kind: 'error', text: 'Whole number 0–100000' });
      return;
    }
    setSavingMargin(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ margin: next }),
      });
      const data = await readJson<{ supplier?: Supplier }>(response);
      if (!response.ok || !data.supplier) throw new Error(data.error || 'Could not save markup.');
      onMarginSaved(supplier.id, data.supplier.margin);
      setFlash({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setFlash({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save markup.' });
    } finally {
      setSavingMargin(false);
    }
  };

  const inputId = `supplier-row-margin-${supplier.id}`;
  const locked = disabled || savingMargin;
  const unchanged = value.trim() === String(supplier.margin ?? 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <label htmlFor={inputId} style={rowLabel}>
        Markup
      </label>
      <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', minWidth: '56px' }}>
        +₹{(supplier.margin ?? 0).toLocaleString('en-IN')}
      </span>
      <input
        id={inputId}
        className="vl-input"
        type="number"
        inputMode="numeric"
        min={0}
        max={100000}
        step={1}
        value={value}
        disabled={locked}
        aria-invalid={flash?.kind === 'error'}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void saveMargin();
          }
        }}
        style={{ ...input(flash?.kind === 'error'), width: '96px' }}
      />
      <button type="button" onClick={() => void saveMargin()} disabled={locked || unchanged} style={button('secondary', locked || unchanged, 'sm')}>
        {savingMargin ? 'Saving…' : 'Save'}
      </button>
      <FlashText flash={flash} />
    </div>
  );
}

/** Inline spreadsheet ID editor for one supplier card. */
function SupplierSheetControls({
  supplier,
  disabled,
  onSaved,
}: {
  supplier: Supplier;
  disabled: boolean;
  onSaved: (updated: Supplier) => void;
}) {
  const [value, setValue] = useState(supplier.spreadsheetId);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useFlash();

  useEffect(() => {
    setValue(supplier.spreadsheetId);
  }, [supplier.spreadsheetId]);

  const nextId = extractSpreadsheetId(value);
  const unchanged = nextId === supplier.spreadsheetId;

  const saveSheet = async () => {
    if (!nextId) {
      setFlash({ kind: 'error', text: 'Spreadsheet ID is required' });
      return;
    }
    if (unchanged) {
      setValue(supplier.spreadsheetId);
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: nextId }),
      });
      const data = await readJson<{ supplier?: Supplier }>(response);
      if (!response.ok || !data.supplier) throw new Error(data.error || 'Could not save spreadsheet.');
      onSaved(data.supplier);
      setFlash({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setFlash({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save spreadsheet.' });
    } finally {
      setSaving(false);
    }
  };

  const locked = disabled || saving;
  const inputId = `supplier-row-sheet-${supplier.id}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={rowLabel}>Sheet</span>
        {supplier.spreadsheetId ? (
          <>
            <a
              href={sheetUrl(supplier.spreadsheetId)}
              target="_blank"
              rel="noopener noreferrer"
              title={sheetUrl(supplier.spreadsheetId)}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: MONO,
                fontSize: '12px',
                color: 'var(--admin-text-muted)',
                textDecoration: 'none',
              }}
            >
              docs.google.com/spreadsheets/d/{supplier.spreadsheetId}
            </a>
            <a
              href={sheetUrl(supplier.spreadsheetId)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 500, color: 'var(--admin-text)', flexShrink: 0 }}
            >
              Open ↗
            </a>
          </>
        ) : (
          <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--admin-text-subtle)' }}>Not set</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', paddingLeft: '80px', flexWrap: 'wrap' }}>
        <input
          id={inputId}
          className="vl-input"
          type="text"
          spellCheck={false}
          aria-label={`Spreadsheet ID for ${supplier.name}`}
          placeholder="Spreadsheet ID or full sheet URL"
          value={value}
          disabled={locked}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void saveSheet();
            }
          }}
          style={{ ...input(flash?.kind === 'error'), flex: 1, minWidth: '160px', fontFamily: MONO, fontSize: '12px' }}
        />
        <button type="button" onClick={() => void saveSheet()} disabled={locked || unchanged} style={button('secondary', locked || unchanged, 'sm')}>
          {saving ? 'Saving…' : 'Update'}
        </button>
        <FlashText flash={flash} />
      </div>
    </div>
  );
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const addSectionRef = useRef<HTMLElement | null>(null);

  const loadSuppliers = async () => {
    const response = await fetch('/api/admin/suppliers', { cache: 'no-store' });
    const data = await readJson<{ suppliers?: Supplier[] }>(response);
    if (!response.ok || !Array.isArray(data.suppliers)) {
      throw new Error(data.error || 'Could not load suppliers.');
    }
    setSuppliers(data.suppliers);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/suppliers', { cache: 'no-store' });
        const data = await readJson<{ suppliers?: Supplier[] }>(response);
        if (!response.ok || !Array.isArray(data.suppliers)) {
          throw new Error(data.error || 'Could not load suppliers.');
        }
        if (!cancelled) setSuppliers(data.suppliers);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load suppliers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setConfirmDeleteId(null);
    setError(null);
    setMessage(null);
    requestAnimationFrame(() => addSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier.id);
    setForm({
      name: supplier.name,
      spreadsheetId: supplier.spreadsheetId,
      sheetTab: supplier.sheetTab || 'Products',
      driveFolderId: supplier.driveFolderId,
      contactName: supplier.contactName,
      contactPhone: supplier.contactPhone,
      notes: supplier.notes,
      margin: String(supplier.margin ?? 0),
    });
    setConfirmDeleteId(null);
    setError(null);
    setMessage(null);
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const nameMissing = form.name.trim() === '';
  const spreadsheetMissing = form.spreadsheetId.trim() === '';
  const marginText = form.margin.trim();
  const marginValue = marginText === '' ? 0 : Number(marginText);
  const marginInvalid = !/^\d+$/.test(marginText || '0') || !Number.isInteger(marginValue) || marginValue < 0 || marginValue > 100000;
  const saveDisabled = saving || nameMissing || spreadsheetMissing || marginInvalid;

  const save = async () => {
    if (nameMissing || spreadsheetMissing) {
      setError('Supplier Name and Spreadsheet ID are required.');
      return;
    }
    if (marginInvalid) {
      setError('Markup must be a whole number of 0 or more.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const isNew = editing === 'new';
    try {
      const response = await fetch(isNew ? '/api/admin/suppliers' : `/api/admin/suppliers/${encodeURIComponent(String(editing))}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sheetTab: form.sheetTab.trim() || 'Products', margin: marginValue }),
      });
      const data = await readJson<{ supplier?: Supplier }>(response);
      if (!response.ok || !data.supplier) throw new Error(data.error || 'Could not save supplier.');
      closeForm();
      setMessage(`Saved ${data.supplier.name}.`);
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (supplier: Supplier) => {
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.id)}`, { method: 'DELETE' });
      const data = await readJson<{ ok?: boolean }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete supplier.');
      setConfirmDeleteId(null);
      if (editing === supplier.id) closeForm();
      setMessage(`Deleted ${supplier.name}.`);
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete supplier.');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const busy = saving || deleting;

  const fields: { key: keyof FormState; label: string; required?: boolean; placeholder?: string }[] = [
    { key: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g. Latecido' },
    { key: 'contactName', label: 'Contact Name' },
    { key: 'contactPhone', label: 'Contact Phone', placeholder: 'e.g. +91 98765 43210' },
    { key: 'spreadsheetId', label: 'Spreadsheet ID', required: true, placeholder: 'From the Google Sheets URL' },
    { key: 'sheetTab', label: 'Sheet Tab', placeholder: 'Products' },
    { key: 'driveFolderId', label: 'Drive Folder ID', placeholder: 'From the Google Drive folder URL' },
  ];

  const isNew = editing === 'new';

  /** The add / edit form body (shared by the collapsible add section and inline card editing). */
  const formBody = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {fields.map((field) => {
          const id = `supplier-${field.key}`;
          return (
            <div key={field.key}>
              <label htmlFor={id} style={fieldLabel}>
                {field.label}
                {field.required ? <span style={{ color: DANGER }}> *</span> : null}
              </label>
              <input
                id={id}
                className="vl-input"
                type={field.key === 'contactPhone' ? 'tel' : 'text'}
                value={form[field.key]}
                placeholder={field.placeholder}
                required={field.required}
                disabled={saving}
                onChange={(event) => updateField(field.key, event.target.value)}
                style={input()}
              />
            </div>
          );
        })}
        <div>
          <label htmlFor="supplier-margin" style={fieldLabel}>
            Markup (₹)
          </label>
          <input
            id="supplier-margin"
            className="vl-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            step={1}
            value={form.margin}
            disabled={saving}
            aria-describedby="supplier-margin-hint"
            aria-invalid={marginInvalid}
            onChange={(event) => updateField('margin', event.target.value)}
            style={input(marginInvalid)}
          />
          <p id="supplier-margin-hint" style={{ ...hint, color: marginInvalid ? DANGER : hint.color }}>
            {marginInvalid ? 'Enter a whole number of 0 or more.' : 'Added to purchase price to set the selling price.'}
          </p>
        </div>
      </div>
      <div>
        <label htmlFor="supplier-notes" style={fieldLabel}>
          Notes
        </label>
        <textarea
          id="supplier-notes"
          className="vl-input"
          value={form.notes}
          rows={3}
          disabled={saving}
          onChange={(event) => updateField('notes', event.target.value)}
          style={{ ...input(), resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={saveDisabled} style={button('primary', saveDisabled)}>
          {saving ? 'Saving…' : isNew ? 'Add Supplier' : 'Save Changes'}
        </button>
        <button type="button" onClick={closeForm} disabled={saving} style={button('ghost', saving)}>
          Cancel
        </button>
        <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--admin-text-subtle)' }}>
          <span style={{ color: DANGER }}>*</span> Required
        </span>
      </div>
    </form>
  );

  return (
    <div style={{ maxWidth: '1100px', fontFamily: SANS }}>
      <style>{ADMIN_FORM_CSS}</style>

      <PageHeader
        title="Suppliers"
        subtitle="Manage supplier sheets and pricing margins"
        actions={
          <button type="button" onClick={openNew} disabled={busy || loading} style={button('primary', busy || loading)}>
            + Add Supplier
          </button>
        }
      />

      {message ? (
        <p role="status" style={{ margin: '0 0 16px', fontSize: '13px', color: OK }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '13px', color: DANGER }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div style={sectionCard}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading suppliers…</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div style={{ ...sectionCard, padding: 0 }}>
          <EmptyState
            title="No suppliers yet"
            description="Add your first supplier to start pulling products and prices from their Google Sheet."
            action={
              <button type="button" onClick={openNew} disabled={busy} style={button('primary', busy)}>
                + Add Supplier
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: '16px' }}>
          {suppliers.map((supplier) => {
            const confirming = confirmDeleteId === supplier.id;
            const contact = [supplier.contactName, supplier.contactPhone].filter(Boolean).join(' · ');
            const isEditing = editing === supplier.id;
            return (
              <article
                key={supplier.id}
                style={{
                  ...sectionCard,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  gridColumn: isEditing ? '1 / -1' : undefined,
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontFamily: SERIF, fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--admin-text)' }}>
                        {supplier.name}
                      </h2>
                      <StatusBadge status={supplier.spreadsheetId ? 'active' : 'inactive'} size="sm" />
                    </div>
                    {contact ? <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>{contact}</p> : null}
                  </div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => openEdit(supplier)}
                      disabled={busy}
                      aria-label={`Edit ${supplier.name}`}
                      style={button('ghost', busy, 'sm')}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>

                {isEditing ? (
                  <div style={{ borderTop: '1px solid var(--admin-border-light)', paddingTop: '16px' }}>
                    <p style={subLabel}>Edit Supplier</p>
                    {formBody}
                  </div>
                ) : (
                  <>
                    <SupplierSheetControls
                      supplier={supplier}
                      disabled={busy}
                      onSaved={(updated) => setSuppliers((current) => current.map((s) => (s.id === updated.id ? updated : s)))}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={rowLabel}>Details</span>
                      <span style={{ fontSize: '12px', color: 'var(--admin-text)' }}>
                        Tab: <strong style={{ fontWeight: 500 }}>{supplier.sheetTab || 'Products'}</strong>
                      </span>
                      {supplier.driveFolderId ? (
                        <a
                          href={driveUrl(supplier.driveFolderId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', fontWeight: 500, color: 'var(--admin-text)', marginLeft: '8px' }}
                        >
                          Drive folder ↗
                        </a>
                      ) : null}
                    </div>

                    <SupplierPricingControls
                      supplier={supplier}
                      disabled={busy}
                      onMarginSaved={(id, margin) =>
                        setSuppliers((current) => current.map((s) => (s.id === id ? { ...s, margin } : s)))
                      }
                    />

                    {supplier.notes ? (
                      <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--admin-text-muted)', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {supplier.notes}
                      </p>
                    ) : null}
                  </>
                )}

                {/* Bottom row */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--admin-border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)' }} title={supplier.updatedAt}>
                    Last updated: {timeAgo(supplier.updatedAt)}
                  </span>
                  {!confirming ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(supplier.id);
                        setError(null);
                        setMessage(null);
                      }}
                      disabled={busy}
                      aria-label={`Delete ${supplier.name}`}
                      style={button('dangerSoft', busy, 'sm')}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                {confirming ? (
                  <div
                    role="alertdialog"
                    aria-label={`Confirm delete ${supplier.name}`}
                    style={{
                      padding: '10px 12px',
                      background: DANGER_BG,
                      border: '1px solid #E8C9BE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: DANGER, fontWeight: 600 }}>Delete {supplier.name}?</span>
                    <span style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => void remove(supplier)} disabled={deleting} style={button('danger', deleting, 'sm')}>
                        {deleting ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                        style={{ ...button('ghost', deleting, 'sm'), background: '#FFFFFF' }}
                      >
                        Cancel
                      </button>
                    </span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Add New Supplier — collapsible */}
      <section ref={addSectionRef} style={{ ...sectionCard, marginTop: '24px', padding: 0, scrollMarginTop: '80px' }}>
        <button
          type="button"
          aria-expanded={isNew}
          aria-controls="add-supplier-panel"
          disabled={busy || loading}
          onClick={() => (isNew ? closeForm() : openNew())}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '18px 24px',
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            cursor: busy || loading ? 'not-allowed' : 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontFamily: SERIF, fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)' }}>Add New Supplier</span>
          <span aria-hidden="true" style={{ fontSize: '18px', color: 'var(--admin-text-muted)', lineHeight: 1 }}>
            {isNew ? '−' : '+'}
          </span>
        </button>
        {isNew ? (
          <div id="add-supplier-panel" style={{ padding: '0 24px 24px' }}>
            <div style={{ ...sectionTitle, margin: '0 0 16px', padding: 0 }} />
            {formBody}
          </div>
        ) : null}
      </section>
    </div>
  );
}
