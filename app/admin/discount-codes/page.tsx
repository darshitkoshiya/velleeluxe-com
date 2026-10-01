'use client';

import { useEffect, useState, type CSSProperties } from 'react';

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

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6A62',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e5e5',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  fontSize: '14px',
  padding: '12px',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
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
    padding: '7px 12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function toggleStyle(on: boolean, disabled: boolean): CSSProperties {
  return {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '999px',
    border: 'none',
    background: on ? '#1E6B45' : '#ccc',
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
    left: on ? '23px' : '3px',
    width: '18px',
    height: '18px',
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

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          margin: '0 0 24px',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Discount Codes</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((open) => !open);
            setError(null);
            setMessage(null);
          }}
          disabled={loading || saving}
          style={primaryButton(loading || saving)}
        >
          {showForm ? 'Close' : '+ Create Code'}
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

      {showForm ? (
        <section style={{ ...sectionStyle, marginBottom: '24px', maxWidth: '640px' }}>
          <h2 style={capsHeading}>Create Code</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label htmlFor="dc-code" style={labelStyle}>
                Code <span style={{ color: '#9A3B1E' }}>*</span>
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
              <p style={{ fontSize: '13px', color: '#6F6A62', margin: '6px 0 0' }}>3–20 letters or numbers.</p>
            </div>

            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={labelStyle}>Type</legend>
              <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="dc-value" style={labelStyle}>
                  {form.type === 'percent' ? 'Percent off' : 'Amount off (₹)'} <span style={{ color: '#9A3B1E' }}>*</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={saveDisabled} style={primaryButton(saveDisabled)}>
                {saving ? 'Creating…' : 'Create Code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                disabled={saving}
                style={{ ...smallButton(saving), padding: '11px 20px', fontSize: '14px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={capsHeading}>All Codes</h2>
        {loading ? (
          <p style={{ margin: 0, color: '#6F6A62' }}>Loading…</p>
        ) : codes.length === 0 ? (
          <p style={{ margin: 0, color: '#6F6A62', fontSize: '14px' }}>No discount codes yet. Create your first code.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Min Order</th>
                  <th style={thStyle}>Uses</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      Delete
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {codes.map((discount) => {
                  const busy = busyCode === discount.code;
                  const expiry = formatExpiry(discount.expiresAt);
                  const usedUp = typeof discount.maxUses === 'number' && discount.usedCount >= discount.maxUses;
                  return (
                    <tr key={discount.code}>
                      <td style={{ ...tdStyle, fontWeight: 600, letterSpacing: '0.04em' }}>{discount.code}</td>
                      <td style={tdStyle}>{discount.type === 'percent' ? '% off' : '₹ off'}</td>
                      <td style={tdStyle}>{discount.type === 'percent' ? `${discount.value}%` : rupees(discount.value)}</td>
                      <td style={tdStyle}>
                        {typeof discount.minOrderAmount === 'number' && discount.minOrderAmount > 0
                          ? rupees(discount.minOrderAmount)
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: usedUp ? '#9A3B1E' : undefined }}>
                        {discount.usedCount ?? 0} / {typeof discount.maxUses === 'number' ? discount.maxUses : '∞'}
                      </td>
                      <td style={{ ...tdStyle, color: expiry.expired ? '#9A3B1E' : undefined }}>
                        {expiry.text}
                        {expiry.expired ? ' (expired)' : ''}
                      </td>
                      <td style={tdStyle}>
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
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {confirmDelete === discount.code ? (
                          <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => void remove(discount.code)}
                              disabled={busy}
                              style={{ ...smallButton(busy), background: '#9A3B1E', color: '#fff', border: '1px solid #9A3B1E' }}
                            >
                              {busy ? 'Deleting…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              disabled={busy}
                              style={smallButton(busy)}
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
                            style={{ ...smallButton(busy), color: '#9A3B1E' }}
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
          </div>
        )}
      </section>
    </div>
  );
}
