'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  OK,
  SANS,
  btn,
  card,
  fieldInput,
  fieldLabel,
  sectionLabel,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';

/** Mirrors DiscountCode in lib/types.ts. */
type DiscountCode = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
  maxUses?: number | null;
  usedCount: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
};

type FormState = {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  minOrderAmount: string;
  maxUses: string;
  expiresAt: string;
};

const EMPTY_FORM: FormState = { code: '', type: 'percent', value: '', minOrderAmount: '', maxUses: '', expiresAt: '' };

const labelStyle: CSSProperties = fieldLabel;
const inputStyle: CSSProperties = fieldInput;

function toggleStyle(on: boolean, disabled: boolean): CSSProperties {
  return {
    position: 'relative',
    width: '36px',
    height: '20px',
    borderRadius: '999px',
    border: 'none',
    background: on ? OK : '#D6D0C4',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    padding: 0,
    flexShrink: 0,
  };
}

function knobStyle(on: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: '3px',
    left: on ? '19px' : '3px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.15s',
  };
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function formatExpiry(iso?: string): { text: string; expired: boolean } {
  if (!iso) return { text: 'Never', expired: false };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { text: '—', expired: false };
  return {
    text: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    expired: Date.now() > date.getTime(),
  };
}

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

export default function AdminDiscountCodesPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCodes = async () => {
    const response = await fetch('/api/admin/discount-codes', { cache: 'no-store' });
    const data = await readJson<{ codes?: DiscountCode[] }>(response);
    if (!response.ok || !Array.isArray(data.codes)) throw new Error(data.error || 'Could not load discount codes.');
    setCodes(data.codes);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/discount-codes', { cache: 'no-store' });
        const data = await readJson<{ codes?: DiscountCode[] }>(response);
        if (!response.ok || !Array.isArray(data.codes)) throw new Error(data.error || 'Could not load discount codes.');
        if (!cancelled) setCodes(data.codes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load discount codes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const codeValid = /^[A-Z0-9]{3,20}$/.test(form.code);
  const valueNum = Number(form.value);
  const valueValid =
    form.value !== '' && Number.isInteger(valueNum) && valueNum >= 1 && (form.type === 'fixed' || valueNum <= 100);
  const saveDisabled = saving || !codeValid || !valueValid;

  const create = async () => {
    if (!codeValid) {
      setError('Code must be 3–20 letters or numbers.');
      return;
    }
    if (!valueValid) {
      setError(form.type === 'percent' ? 'Percent off must be a whole number from 1 to 100.' : 'Amount off must be a whole number of at least ₹1.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: valueNum,
          minOrderAmount: form.minOrderAmount === '' ? undefined : Number(form.minOrderAmount),
          maxUses: form.maxUses === '' ? undefined : Number(form.maxUses),
          // End of the chosen day, India time.
          expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59+05:30` : undefined,
        }),
      });
      const data = await readJson<{ code?: DiscountCode }>(response);
      if (!response.ok || !data.code) throw new Error(data.error || 'Could not create discount code.');
      setMessage(`Created ${data.code.code}.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create discount code.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (discount: DiscountCode) => {
    setBusyCode(discount.code);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/discount-codes/${encodeURIComponent(discount.code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !discount.active }),
      });
      const data = await readJson<{ ok?: boolean }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update discount code.');
      setCodes((current) => current.map((c) => (c.code === discount.code ? { ...c, active: !discount.active } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update discount code.');
    } finally {
      setBusyCode(null);
    }
  };

  const remove = async (code: string) => {
    setBusyCode(code);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/discount-codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
      const data = await readJson<{ ok?: boolean }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete discount code.');
      setConfirmDelete(null);
      setMessage(`Deleted ${code}.`);
      setCodes((current) => current.filter((c) => c.code !== code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete discount code.');
    } finally {
      setBusyCode(null);
    }
  };

  const toggleForm = () => {
    setShowForm((open) => !open);
    setError(null);
    setMessage(null);
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>

      <PageHeader
        title="Discount Codes"
        subtitle={loading ? 'Loading codes…' : `${codes.length} ${codes.length === 1 ? 'code' : 'codes'}`}
        actions={
          <button
            type="button"
            onClick={toggleForm}
            disabled={loading || saving}
            style={btn(showForm ? 'secondary' : 'primary', { disabled: loading || saving })}
          >
            {showForm ? 'Close' : '+ New Code'}
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

      {showForm ? (
        <section style={{ ...card, padding: '24px', marginBottom: '24px', maxWidth: '640px' }}>
          <h2 style={{ ...sectionLabel, marginBottom: '16px' }}>Create Code</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label htmlFor="dc-code" style={labelStyle}>
                Code <span style={{ color: DANGER }}>*</span>
              </label>
              <input
                id="dc-code"
                type="text"
                value={form.code}
                placeholder="e.g. LAUNCH10"
                maxLength={20}
                autoComplete="off"
                disabled={saving}
                onChange={(event) => updateField('code', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
              <p style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', margin: '6px 0 0' }}>3–20 letters or numbers.</p>
            </div>

            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={labelStyle}>Type</legend>
              <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: 'var(--admin-text)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dc-type"
                    checked={form.type === 'percent'}
                    disabled={saving}
                    onChange={() => updateField('type', 'percent')}
                  />
                  % off
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dc-type"
                    checked={form.type === 'fixed'}
                    disabled={saving}
                    onChange={() => updateField('type', 'fixed')}
                  />
                  ₹ off
                </label>
              </div>
            </fieldset>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="dc-value" style={labelStyle}>
                  {form.type === 'percent' ? 'Percent off' : 'Amount off (₹)'} <span style={{ color: DANGER }}>*</span>
                </label>
                <input
                  id="dc-value"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={form.type === 'percent' ? 100 : undefined}
                  step={1}
                  value={form.value}
                  disabled={saving}
                  onChange={(event) => updateField('value', event.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="dc-min" style={labelStyle}>
                  Min order (₹)
                </label>
                <input
                  id="dc-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.minOrderAmount}
                  placeholder="None"
                  disabled={saving}
                  onChange={(event) => updateField('minOrderAmount', event.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="dc-max" style={labelStyle}>
                  Max uses
                </label>
                <input
                  id="dc-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.maxUses}
                  placeholder="Unlimited"
                  disabled={saving}
                  onChange={(event) => updateField('maxUses', event.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="dc-expires" style={labelStyle}>
                  Expires on
                </label>
                <input
                  id="dc-expires"
                  type="date"
                  value={form.expiresAt}
                  disabled={saving}
                  onChange={(event) => updateField('expiresAt', event.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={saveDisabled} style={btn('primary', { disabled: saveDisabled })}>
                {saving ? 'Creating…' : 'Create Code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                disabled={saving}
                style={btn('secondary', { disabled: saving })}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div style={tableFrame}>
        {loading ? (
          <p style={{ margin: 0, padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
            Loading codes…
          </p>
        ) : codes.length === 0 ? (
          <EmptyState
            title="No discount codes"
            description="Create a code to offer customers a percentage or fixed amount off at checkout."
            action={
              !showForm ? (
                <button type="button" onClick={toggleForm} style={btn('primary')}>
                  + Create Code
                </button>
              ) : undefined
            }
          />
        ) : (
          <table style={{ ...tableStyle, minWidth: '860px' }}>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={th}>Discount</th>
                <th style={th}>Type</th>
                <th style={th}>Uses / Limit</th>
                <th style={th}>Expiry</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((discount) => {
                const busy = busyCode === discount.code;
                const expiry = formatExpiry(discount.expiresAt);
                const usedUp = typeof discount.maxUses === 'number' && discount.usedCount >= discount.maxUses;
                const statusKey = !discount.active ? 'inactive' : expiry.expired ? 'expired' : usedUp ? 'used_up' : 'active';
                return (
                  <tr key={discount.code} className="vl-row">
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          border: '1px dashed var(--admin-border)',
                          borderRadius: '4px',
                          background: '#F9F6F0',
                          fontSize: '12px',
                        }}
                      >
                        {discount.code}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>
                        {discount.type === 'percent' ? `${discount.value}% off` : `${rupees(discount.value)} off`}
                      </div>
                      {typeof discount.minOrderAmount === 'number' && discount.minOrderAmount > 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                          Min order {rupees(discount.minOrderAmount)}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>
                      {discount.type === 'percent' ? 'Percentage' : 'Fixed amount'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: usedUp ? DANGER : undefined }}>
                      {discount.usedCount ?? 0} / {typeof discount.maxUses === 'number' ? discount.maxUses : '∞'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: expiry.expired ? DANGER : undefined }}>
                      {expiry.text}
                      {expiry.expired ? ' (expired)' : ''}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={discount.active}
                          aria-label={`${discount.active ? 'Deactivate' : 'Activate'} ${discount.code}`}
                          disabled={busy}
                          onClick={() => void toggleActive(discount)}
                          style={toggleStyle(discount.active, busy)}
                        >
                          <span style={knobStyle(discount.active)} />
                        </button>
                        <StatusBadge status={statusKey} size="sm" />
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {confirmDelete === discount.code ? (
                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => void remove(discount.code)}
                            disabled={busy}
                            style={btn('danger', { size: 'sm', disabled: busy })}
                          >
                            {busy ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            disabled={busy}
                            style={btn('secondary', { size: 'sm', disabled: busy })}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete(discount.code);
                            setError(null);
                            setMessage(null);
                          }}
                          disabled={busy}
                          aria-label={`Delete ${discount.code}`}
                          style={btn('dangerOutline', { size: 'sm', disabled: busy })}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

