'use client';

/**
 * Admin dashboard card: forces the product catalog to reload from the supplier
 * sheets right now (POST /api/admin/sync) instead of waiting for the 3-hour cache.
 */
import { useState } from 'react';

type SyncState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; at: string }
  | { kind: 'error'; message: string };

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
};

const button: React.CSSProperties = {
  background: '#1C2230',
  color: '#F6F1E8',
  padding: '12px 20px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

export default function SyncProductsCard() {
  const [state, setState] = useState<SyncState>({ kind: 'idle' });

  async function handleSync() {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/admin/sync', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as { revalidatedAt?: string; error?: string };
      if (!response.ok) {
        setState({ kind: 'error', message: data.error || `Sync failed (status ${response.status}).` });
        return;
      }
      setState({ kind: 'success', at: data.revalidatedAt || new Date().toISOString() });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }

  const loading = state.kind === 'loading';

  return (
    <div style={card}>
      <div>
        <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
          {state.kind === 'success' ? 'Synced — products refreshed' : 'Sync Products Now'}
        </p>
        {state.kind === 'success' ? (
          <p role="status" style={{ fontSize: '13px', color: '#2E7D4F', margin: '4px 0 0' }}>
            Last synced {formatTime(state.at)}
          </p>
        ) : state.kind === 'error' ? (
          <p role="alert" style={{ fontSize: '13px', color: '#C0392B', margin: '4px 0 0' }}>
            {state.message}
          </p>
        ) : (
          <p style={{ fontSize: '13px', color: '#6F6A62', margin: '4px 0 0' }}>
            Force-reload all supplier sheets immediately
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        style={{ ...button, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Syncing…' : 'Sync Products Now'}
      </button>
    </div>
  );
}
