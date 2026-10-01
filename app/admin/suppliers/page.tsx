'use client';

import { useEffect, useState, type CSSProperties } from 'react';

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
};

const EMPTY_FORM: FormState = {
  name: '',
  spreadsheetId: '',
  sheetTab: 'Products',
  driveFolderId: '',
  contactName: '',
  contactPhone: '',
  notes: '',
};

/** null = form closed, 'new' = adding, otherwise the id being edited. */
type Editing = null | 'new' | string;

const sectionStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '24px',
};

const capsHeading: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };

const inputStyle: CSSProperties = {
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

function primaryButton(disabled: boolean): CSSProperties {
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
  };
}

function smallButton(disabled: boolean): CSSProperties {
  return {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };
}

function sheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`;
}

function driveUrl(driveFolderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(driveFolderId)}`;
}

const linkButton: CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  color: '#1C2230',
  border: '1px solid #1C2230',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  background: '#F6F1E8',
  color: '#6F6A62',
  border: '1px solid #e5e5e5',
  borderRadius: '999px',
  padding: '2px 10px',
  fontSize: '12px',
  fontWeight: 500,
};

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
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
  const saveDisabled = saving || nameMissing || spreadsheetMissing;

  const save = async () => {
    if (nameMissing || spreadsheetMissing) {
      setError('Supplier Name and Spreadsheet ID are required.');
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
        body: JSON.stringify({ ...form, sheetTab: form.sheetTab.trim() || 'Products' }),
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

  const fields: { key: keyof FormState; label: string; required?: boolean; placeholder?: string; hint?: string }[] = [
    { key: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g. Latecido' },
    { key: 'contactName', label: 'Contact Name' },
    { key: 'contactPhone', label: 'Contact Phone', placeholder: 'e.g. +91 98765 43210' },
    {
      key: 'spreadsheetId',
      label: 'Spreadsheet ID',
      required: true,
      placeholder: 'From the Google Sheets URL',
    },
    { key: 'sheetTab', label: 'Sheet Tab', placeholder: 'Products' },
    {
      key: 'driveFolderId',
      label: 'Drive Folder ID',
      placeholder: 'From the Google Drive folder URL',
    },
  ];

  const formSection = (
    <section style={{ ...sectionStyle, marginBottom: editing === 'new' ? '24px' : 0 }}>
      <h2 style={capsHeading}>{editing === 'new' ? 'Add Supplier' : 'Edit Supplier'}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {fields.map((field) => {
          const id = `supplier-${field.key}`;
          return (
            <div key={field.key}>
              <label htmlFor={id} style={labelStyle}>
                {field.label}
                {field.required ? <span style={{ color: '#9A3B1E' }}> *</span> : null}
              </label>
              <input
                id={id}
                type={field.key === 'contactPhone' ? 'tel' : 'text'}
                value={form[field.key]}
                placeholder={field.placeholder}
                required={field.required}
                disabled={saving}
                aria-describedby={field.hint ? `${id}-hint` : undefined}
                onChange={(event) => updateField(field.key, event.target.value)}
                style={inputStyle}
              />
              {field.hint ? (
                <p id={`${id}-hint`} style={{ fontSize: '13px', color: '#6F6A62', margin: '6px 0 0' }}>
                  {field.hint}
                </p>
              ) : null}
            </div>
          );
        })}
        <div>
          <label htmlFor="supplier-notes" style={labelStyle}>
            Notes
          </label>
          <textarea
            id="supplier-notes"
            value={form.notes}
            rows={3}
            disabled={saving}
            onChange={(event) => updateField('notes', event.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <p style={{ fontSize: '13px', color: '#6F6A62', margin: 0 }}>
          <span style={{ color: '#9A3B1E' }}>*</span> Required
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saveDisabled} style={primaryButton(saveDisabled)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={closeForm} disabled={saving} style={{ ...smallButton(saving), padding: '11px 20px', fontSize: '14px' }}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div style={{ maxWidth: '880px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', margin: '0 0 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Suppliers</h1>
        <button type="button" onClick={openNew} disabled={busy || loading} style={primaryButton(busy || loading)}>
          + Add Supplier
        </button>
      </div>

      {message ? (
        <p role="status" style={{ margin: '0 0 16px', fontSize: '14px', color: '#1E6B45' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}

      {editing === 'new' ? formSection : null}

      <section style={sectionStyle}>
        <h2 style={capsHeading}>All Suppliers</h2>
        {loading ? (
          <p style={{ margin: 0, color: '#6F6A62' }}>Loading…</p>
        ) : suppliers.length === 0 ? (
          <p style={{ margin: 0, color: '#6F6A62', fontSize: '14px' }}>No suppliers yet. Add your first supplier.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {suppliers.map((supplier, index) => {
              const confirming = confirmDeleteId === supplier.id;
              const contact = [supplier.contactName, supplier.contactPhone].filter(Boolean).join(' · ');
              return (
                <li
                  key={supplier.id}
                  style={{
                    padding: '16px 0',
                    borderTop: index === 0 ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  {editing === supplier.id ? (
                    formSection
                  ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{supplier.name}</p>
                      {contact ? <p style={{ fontSize: '13px', color: '#6F6A62', margin: '4px 0 0' }}>{contact}</p> : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {supplier.spreadsheetId ? (
                          <a href={sheetUrl(supplier.spreadsheetId)} target="_blank" rel="noopener noreferrer" style={linkButton}>
                            Sheet ↗
                          </a>
                        ) : null}
                        {supplier.driveFolderId ? (
                          <a href={driveUrl(supplier.driveFolderId)} target="_blank" rel="noopener noreferrer" style={linkButton}>
                            Drive ↗
                          </a>
                        ) : null}
                        <span style={badgeStyle} title="Sheet tab">
                          {supplier.sheetTab || 'Products'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(supplier)}
                        disabled={busy}
                        aria-label={`Edit ${supplier.name}`}
                        style={smallButton(busy)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(supplier.id);
                          setError(null);
                          setMessage(null);
                        }}
                        disabled={busy}
                        aria-label={`Delete ${supplier.name}`}
                        style={{ ...smallButton(busy), color: '#9A3B1E' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  )}

                  {confirming ? (
                    <div
                      role="alertdialog"
                      aria-label={`Confirm delete ${supplier.name}`}
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        background: '#F5E1DA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#9A3B1E', fontWeight: 600 }}>
                        Delete {supplier.name}?
                      </span>
                      <span style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => void remove(supplier)}
                          disabled={deleting}
                          style={{ ...smallButton(deleting), background: '#9A3B1E', color: '#fff', border: '1px solid #9A3B1E' }}
                        >
                          {deleting ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleting} style={{ ...smallButton(deleting), background: '#fff' }}>
                          Cancel
                        </button>
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
