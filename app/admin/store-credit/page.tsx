'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { StoreCredit, StoreCreditEntryType } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface Customer {
  uid: string;
  email: string;
  name: string;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '20px' };
const sectionTitle: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
  margin: '0 0 12px',
  fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxSizing: 'border-box',
  marginTop: '6px',
  background: '#fff',
  fontFamily: 'inherit',
};
const label: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '14px' };
const primaryButton: React.CSSProperties = {
  background: '#1C2230',
  color: '#F6F1E8',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6A62',
  borderBottom: '1px solid #e5e5e5',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '14px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' };
const CREDIT_COLOUR = '#1E6B45';
const DEBIT_COLOUR = '#9A3B1E';

export default function AdminStoreCreditPage() {
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [type, setType] = useState<StoreCreditEntryType>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [tpin, setTpin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lookup = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLooking(true);
    setLookupError(null);
    setNotice(null);
    try {
      const param = trimmed.includes('@') ? `email=${encodeURIComponent(trimmed)}` : `uid=${encodeURIComponent(trimmed)}`;
      const response = await fetch(`/api/admin/store-credit?${param}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as { customer?: Customer; credit?: StoreCredit; error?: string };
      if (!response.ok || !data.customer) throw new Error(data.error || 'Customer not found.');
      setCustomer(data.customer);
      setCredit(data.credit ?? { balance: 0, transactions: [] });
    } catch (err) {
      setCustomer(null);
      setCredit(null);
      setLookupError(err instanceof Error ? err.message : 'Customer not found.');
    } finally {
      setLooking(false);
    }
  }, []);

  // Deep link from a return: /admin/store-credit?uid=...&orderId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('uid') || params.get('email') || '';
    if (params.get('orderId')) setOrderId(params.get('orderId') ?? '');
    if (preset) {
      setQuery(preset);
      void lookup(preset);
    }
  }, [lookup]);

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void lookup(query);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    setError(null);
    setNotice(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than 0.');
    if (!reason.trim()) return setError('A reason is required.');
    if (!tpin.trim()) return setError('Enter your TPIN to confirm.');

    setSaving(true);
    try {
      const response = await fetch('/api/admin/store-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: customer.uid, type, amount: value, reason: reason.trim(), orderId: orderId.trim(), tpin }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; balance?: number; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save the adjustment.');
      setNotice(
        `${type === 'credit' ? 'Added' : 'Deducted'} ${formatPrice(value)}. New balance: ${formatPrice(data.balance ?? 0)}.`,
      );
      setAmount('');
      setReason('');
      setTpin('');
      await lookup(customer.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Store Credit</h1>

      <form onSubmit={handleLookup} style={{ ...card, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...label, flex: '1 1 280px', marginBottom: 0 }}>
          Customer email or UID
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="customer@example.com"
            style={input}
          />
        </label>
        <button type="submit" style={{ ...primaryButton, opacity: looking ? 0.6 : 1 }} disabled={looking}>
          {looking ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {lookupError ? (
        <p role="alert" style={{ background: '#F5E1DA', color: DEBIT_COLOUR, padding: '12px 16px', borderRadius: '6px', fontSize: '14px', marginTop: '16px' }}>
          {lookupError}
        </p>
      ) : null}

      {customer && credit ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '16px', alignItems: 'start' }}>
            <section style={card}>
              <h2 style={sectionTitle}>Customer</h2>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{customer.name || '—'}</p>
              <p style={{ margin: '0 0 4px', fontSize: '14px', wordBreak: 'break-all' }}>{customer.email}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#6F6A62', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
                {customer.uid}
              </p>
              <p style={{ ...sectionTitle, margin: '20px 0 4px' }}>Balance</p>
              <p style={{ fontSize: '32px', fontWeight: 600, margin: 0 }}>{formatPrice(credit.balance)}</p>
            </section>

            <form onSubmit={handleSave} style={card}>
              <h2 style={sectionTitle}>Manual adjustment</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <label style={label}>
                  Type
                  <select value={type} onChange={(event) => setType(event.target.value as StoreCreditEntryType)} style={input}>
                    <option value="credit">Credit (CR) — add</option>
                    <option value="debit">Debit (DR) — deduct</option>
                  </select>
                </label>
                <label style={label}>
                  Amount (₹)
                  <input type="number" min={1} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} style={input} />
                </label>
              </div>
              <label style={label}>
                Reason <span style={{ color: DEBIT_COLOUR }}>*</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Goodwill credit, Correction for order VL-123"
                  maxLength={300}
                  style={input}
                />
              </label>
              <label style={label}>
                Linked order ID <span style={{ color: '#6F6A62', fontWeight: 400 }}>(optional)</span>
                <input type="text" value={orderId} onChange={(event) => setOrderId(event.target.value)} style={input} />
              </label>
              <label style={label}>
                TPIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={tpin}
                  onChange={(event) => setTpin(event.target.value)}
                  style={input}
                />
              </label>
              {error ? (
                <p role="alert" style={{ color: DEBIT_COLOUR, fontSize: '14px', margin: '0 0 14px' }}>
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p role="status" style={{ color: CREDIT_COLOUR, fontSize: '14px', margin: '0 0 14px' }}>
                  {notice}
                </p>
              ) : null}
              <button type="submit" style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                {saving ? 'Saving…' : type === 'credit' ? 'Add Credit' : 'Deduct Credit'}
              </button>
            </form>
          </div>

          <section style={{ ...card, marginTop: '16px', padding: 0, overflowX: 'auto' }}>
            <h2 style={{ ...sectionTitle, padding: '20px 20px 0' }}>Ledger</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Type</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Order / Return</th>
                  <th style={th}>By</th>
                </tr>
              </thead>
              <tbody>
                {credit.transactions.length === 0 ? (
                  <tr>
                    <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={6}>
                      No store credit yet.
                    </td>
                  </tr>
                ) : (
                  credit.transactions.map((entry, index) => {
                    const isCredit = entry.type !== 'debit';
                    return (
                      <tr key={entry.id || `${entry.createdAt}-${index}`}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</td>
                        <td style={{ ...td, fontWeight: 600, color: isCredit ? CREDIT_COLOUR : DEBIT_COLOUR }}>{isCredit ? 'CR' : 'DR'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600, color: isCredit ? CREDIT_COLOUR : DEBIT_COLOUR }}>
                          {isCredit ? '+' : '-'}
                          {formatPrice(Math.abs(entry.amount))}
                        </td>
                        <td style={td}>{entry.reason}</td>
                        <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}>
                          {entry.orderId || '—'}
                          {entry.returnId ? <div style={{ color: '#6F6A62' }}>{entry.returnId}</div> : null}
                        </td>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{entry.createdBy || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
