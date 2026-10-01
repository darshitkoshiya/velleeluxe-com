'use client';

import { useEffect, useState } from 'react';

/** Must match MAX_FREE_SHIPPING_THRESHOLD in lib/settings.ts (the API enforces it). */
const MAX_FREE_SHIPPING_THRESHOLD = 100000;

type SettingsResponse = { codEnabled?: boolean; freeShippingThreshold?: number; error?: string };

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Returns the whole-rupee threshold typed in the box, or null if it is not valid. */
function parseThreshold(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= MAX_FREE_SHIPPING_THRESHOLD ? amount : null;
}

export default function AdminSettingsPage() {
  /** What is saved in the database right now. */
  const [savedCod, setSavedCod] = useState<boolean | null>(null);
  /** What the switch currently shows (may be unsaved). */
  const [codEnabled, setCodEnabled] = useState(true);
  /** Free-shipping threshold saved in the database right now. */
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  /** What the threshold box currently shows (may be unsaved or not yet valid). */
  const [thresholdInput, setThresholdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as SettingsResponse;
        if (!response.ok || typeof data.codEnabled !== 'boolean' || typeof data.freeShippingThreshold !== 'number') {
          throw new Error(data.error || 'Could not load settings.');
        }
        if (!cancelled) {
          setSavedCod(data.codEnabled);
          setCodEnabled(data.codEnabled);
          setSavedThreshold(data.freeShippingThreshold);
          setThresholdInput(String(data.freeShippingThreshold));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const threshold = parseThreshold(thresholdInput);
  const thresholdInvalid = savedThreshold !== null && threshold === null;

  const save = async () => {
    if (threshold === null) {
      setError(`Free shipping threshold must be a whole number between 0 and ${formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codEnabled, freeShippingThreshold: threshold }),
      });
      const data = (await response.json().catch(() => ({}))) as SettingsResponse;
      if (!response.ok || typeof data.codEnabled !== 'boolean' || typeof data.freeShippingThreshold !== 'number') {
        throw new Error(data.error || 'Could not save settings.');
      }
      setSavedCod(data.codEnabled);
      setCodEnabled(data.codEnabled);
      setSavedThreshold(data.freeShippingThreshold);
      setThresholdInput(String(data.freeShippingThreshold));
      setMessage(
        `Saved. Cash on Delivery is now ${data.codEnabled ? 'ON' : 'OFF'} and shipping is free on orders of ${formatRupees(data.freeShippingThreshold)} or more.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const unsaved =
    (savedCod !== null && savedCod !== codEnabled) ||
    (savedThreshold !== null && thresholdInput.trim() !== String(savedThreshold));
  const notLoaded = savedCod === null || savedThreshold === null;
  const saveDisabled = saving || notLoaded || !unsaved || thresholdInvalid;

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Settings</h1>

      <section style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '24px' }}>
        {loading ? (
          <p style={{ margin: 0, color: '#6F6A62' }}>Loading…</p>
        ) : (
          <>
            {savedCod !== null ? (
              <p
                style={{
                  margin: '0 0 20px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 600,
                  background: savedCod ? '#E0F2E9' : '#F5E1DA',
                  color: savedCod ? '#1E6B45' : '#9A3B1E',
                }}
              >
                COD is currently {savedCod ? 'ON' : 'OFF'}
              </p>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
              <div>
                <h2 id="cod-label" style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>
                  Cash on Delivery
                </h2>
                <p id="cod-description" style={{ fontSize: '14px', color: '#6F6A62', margin: 0, lineHeight: 1.5 }}>
                  When enabled, customers can choose to pay cash when the order arrives.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={codEnabled}
                aria-labelledby="cod-label"
                aria-describedby="cod-description"
                disabled={savedCod === null || saving}
                onClick={() => {
                  setCodEnabled((value) => !value);
                  setMessage(null);
                }}
                style={{
                  flexShrink: 0,
                  position: 'relative',
                  width: '56px',
                  height: '30px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: savedCod === null || saving ? 'not-allowed' : 'pointer',
                  background: codEnabled ? '#1E6B45' : '#bbb',
                  transition: 'background 0.2s',
                  padding: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: codEnabled ? '29px' : '3px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 0', textAlign: 'right', color: codEnabled ? '#1E6B45' : '#6F6A62' }}>
              {codEnabled ? 'ON' : 'OFF'}
            </p>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Shipping
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
                <div>
                  <label htmlFor="free-shipping-threshold" style={{ display: 'block', fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>
                    Free Shipping Threshold (₹)
                  </label>
                  <p id="free-shipping-description" style={{ fontSize: '14px', color: '#6F6A62', margin: 0, lineHeight: 1.5 }}>
                    Orders at or above this amount ship free. Below it, a flat delivery fee is charged. The cart progress bar and
                    checkout both use this value.
                  </p>
                  {savedThreshold !== null ? (
                    <p style={{ fontSize: '13px', color: '#6F6A62', margin: '8px 0 0' }}>
                      Currently: free shipping on orders of {formatRupees(savedThreshold)} or more.
                    </p>
                  ) : null}
                </div>

                <input
                  id="free-shipping-threshold"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_FREE_SHIPPING_THRESHOLD}
                  step={1}
                  value={thresholdInput}
                  aria-describedby="free-shipping-description"
                  aria-invalid={thresholdInvalid}
                  disabled={savedThreshold === null || saving}
                  onChange={(event) => {
                    setThresholdInput(event.target.value);
                    setMessage(null);
                  }}
                  style={{
                    flexShrink: 0,
                    width: '140px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    border: `1px solid ${thresholdInvalid ? '#9A3B1E' : '#ccc'}`,
                    borderRadius: '6px',
                    background: '#fff',
                  }}
                />
              </div>
              {thresholdInvalid ? (
                <p style={{ fontSize: '13px', margin: '8px 0 0', textAlign: 'right', color: '#9A3B1E' }}>
                  Enter a whole number from 0 to {formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.
                </p>
              ) : null}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saveDisabled}
                style={{
                  background: '#1C2230',
                  color: '#F6F1E8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: saveDisabled ? 'not-allowed' : 'pointer',
                  opacity: saveDisabled ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {unsaved ? <span style={{ fontSize: '13px', color: '#8A6100' }}>You have unsaved changes.</span> : null}
            </div>
          </>
        )}

        {message ? (
          <p role="status" style={{ margin: '16px 0 0', fontSize: '14px', color: '#1E6B45' }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: '16px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
