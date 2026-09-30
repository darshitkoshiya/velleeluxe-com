'use client';

import { useEffect, useState } from 'react';

export default function AdminSettingsPage() {
  /** What is saved in the database right now. */
  const [savedCod, setSavedCod] = useState<boolean | null>(null);
  /** What the switch currently shows (may be unsaved). */
  const [codEnabled, setCodEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as { codEnabled?: boolean; error?: string };
        if (!response.ok || typeof data.codEnabled !== 'boolean') throw new Error(data.error || 'Could not load settings.');
        if (!cancelled) {
          setSavedCod(data.codEnabled);
          setCodEnabled(data.codEnabled);
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

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codEnabled }),
      });
      const data = (await response.json().catch(() => ({}))) as { codEnabled?: boolean; error?: string };
      if (!response.ok || typeof data.codEnabled !== 'boolean') throw new Error(data.error || 'Could not save settings.');
      setSavedCod(data.codEnabled);
      setCodEnabled(data.codEnabled);
      setMessage(`Saved. Cash on Delivery is now ${data.codEnabled ? 'ON' : 'OFF'} for customers.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const unsaved = savedCod !== null && savedCod !== codEnabled;

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

            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || savedCod === null || !unsaved}
                style={{
                  background: '#1C2230',
                  color: '#F6F1E8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: saving || !unsaved ? 'not-allowed' : 'pointer',
                  opacity: saving || !unsaved ? 0.5 : 1,
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
