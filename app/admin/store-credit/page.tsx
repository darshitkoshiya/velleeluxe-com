'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { StoreCredit, StoreCreditEntryType } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import PageHeader from '@/components/admin/ui/PageHeader';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  DANGER_BG,
  DANGER_BORDER,
  MONO,
  OK,
  SANS,
  SERIF,
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

const CREDIT_COLOUR = OK;
const DEBIT_COLOUR = DANGER;

const field: CSSProperties = { marginBottom: '14px' };
const alertBox: CSSProperties = {
  background: DANGER_BG,
  color: DANGER,
  border: `1px solid ${DANGER_BORDER}`,
  borderRadius: '6px',
  padding: '10px 16px',
  fontSize: '13px',
  marginTop: '16px',
};

export default function AdminStoreCreditPage() {
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
    if (params.get('orderId')) {
      setOrderId(params.get('orderId') ?? '');
      setShowForm(true);
    }
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

  const issued = credit
    ? credit.transactions.filter((t) => t.type !== 'debit').reduce((sum, t) => sum + Math.abs(t.amount), 0)
    : 0;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>

      <PageHeader
        title="Store Credit"
        subtitle="Look up a customer to view their balance, ledger and make adjustments."
        actions={
          customer && credit ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((open) => !open);
                setError(null);
              }}
              style={btn(showForm ? 'secondary' : 'primary')}
            >
              {showForm ? 'Close form' : 'Issue Store Credit'}
            </button>
          ) : undefined
        }
      />

      <form onSubmit={handleLookup} style={{ ...card, padding: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 280px' }}>
          <label htmlFor="sc-query" style={fieldLabel}>
            Customer email or UID
          </label>
          <input
            id="sc-query"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="customer@example.com"
            style={fieldInput}
          />
        </div>
        <button type="submit" style={btn('primary', { disabled: looking })} disabled={looking}>
          {looking ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {lookupError ? (
        <div role="alert" style={alertBox}>
          {lookupError}
        </div>
      ) : null}

      {customer && credit ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
              marginTop: '16px',
              alignItems: 'start',
            }}
          >
            <section style={{ ...card, padding: '20px 24px' }}>
              <h2 style={{ ...sectionLabel, marginBottom: '12px' }}>Customer</h2>
              <p style={{ margin: '0 0 4px', fontFamily: SERIF, fontSize: '20px', color: 'var(--admin-text)' }}>{customer.name || '—'}</p>
              <p style={{ margin: '0 0 4px', fontSize: '13px', wordBreak: 'break-all', color: 'var(--admin-text)' }}>{customer.email}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--admin-text-subtle)', fontFamily: MONO, wordBreak: 'break-all' }}>
                {customer.uid}
              </p>

              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--admin-border-light)' }}>
                <div>
                  <p style={sectionLabel}>Balance</p>
                  <p style={{ fontSize: '28px', fontWeight: 600, margin: '6px 0 0', color: 'var(--admin-text)' }}>{formatPrice(credit.balance)}</p>
                </div>
                <div>
                  <p style={sectionLabel}>Total issued</p>
                  <p style={{ fontSize: '18px', fontWeight: 500, margin: '12px 0 0', color: 'var(--admin-text-muted)' }}>{formatPrice(issued)}</p>
                </div>
              </div>

              {!showForm ? (
                <button type="button" onClick={() => setShowForm(true)} style={{ ...btn('secondary', { size: 'sm' }), marginTop: '20px' }}>
                  Adjust balance
                </button>
              ) : null}
              {!showForm && notice ? (
                <p role="status" style={{ color: CREDIT_COLOUR, fontSize: '13px', margin: '12px 0 0' }}>
                  {notice}
                </p>
              ) : null}
            </section>

            {showForm ? (
              <form onSubmit={handleSave} style={{ ...card, padding: '20px 24px' }}>
                <h2 style={{ ...sectionLabel, marginBottom: '16px' }}>Issue / adjust store credit</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <div style={field}>
                    <label htmlFor="sc-type" style={fieldLabel}>
                      Type
                    </label>
                    <select
                      id="sc-type"
                      value={type}
                      onChange={(event) => setType(event.target.value as StoreCreditEntryType)}
                      style={fieldInput}
                    >
                      <option value="credit">Credit (CR) — add</option>
                      <option value="debit">Debit (DR) — deduct</option>
                    </select>
                  </div>
                  <div style={field}>
                    <label htmlFor="sc-amount" style={fieldLabel}>
                      Amount (₹)
                    </label>
                    <input
                      id="sc-amount"
                      type="number"
                      min={1}
                      step="1"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      style={fieldInput}
                    />
                  </div>
                </div>
                <div style={field}>
                  <label htmlFor="sc-reason" style={fieldLabel}>
                    Reason <span style={{ color: DEBIT_COLOUR }}>*</span>
                  </label>
                  <input
                    id="sc-reason"
                    type="text"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. Goodwill credit, Correction for order VL-123"
                    maxLength={300}
                    style={fieldInput}
                  />
                </div>
                <div style={field}>
                  <label htmlFor="sc-order" style={fieldLabel}>
                    Linked order ID <span style={{ color: 'var(--admin-text-subtle)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input id="sc-order" type="text" value={orderId} onChange={(event) => setOrderId(event.target.value)} style={fieldInput} />
                </div>
                <div style={field}>
                  <label htmlFor="sc-tpin" style={fieldLabel}>
                    TPIN
                  </label>
                  <input
                    id="sc-tpin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={tpin}
                    onChange={(event) => setTpin(event.target.value)}
                    style={fieldInput}
                  />
                </div>
                {error ? (
                  <p role="alert" style={{ color: DEBIT_COLOUR, fontSize: '13px', margin: '0 0 14px' }}>
                    {error}
                  </p>
                ) : null}
                {notice ? (
                  <p role="status" style={{ color: CREDIT_COLOUR, fontSize: '13px', margin: '0 0 14px' }}>
                    {notice}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="submit" style={btn('primary', { disabled: saving })} disabled={saving}>
                    {saving ? 'Saving…' : type === 'credit' ? 'Add Credit' : 'Deduct Credit'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} style={btn('secondary', { disabled: saving })} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <h2 style={{ ...sectionLabel, margin: '28px 0 10px' }}>Ledger</h2>
          <div style={tableFrame}>
            {credit.transactions.length === 0 ? (
              <EmptyState title="No store credit issued." description="Credits and deductions for this customer will appear here." />
            ) : (
              <table style={{ ...tableStyle, minWidth: '760px' }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th style={th}>Reason</th>
                    <th style={th}>Order / Return</th>
                    <th style={th}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {credit.transactions.map((entry, index) => {
                    const isCredit = entry.type !== 'debit';
                    const colour = isCredit ? CREDIT_COLOUR : DEBIT_COLOUR;
                    return (
                      <tr key={entry.id || `${entry.createdAt}-${index}`} className="vl-row">
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{formatDateTime(entry.createdAt)}</td>
                        <td style={td}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: isCredit ? '#E0F2E9' : DANGER_BG,
                              color: colour,
                            }}
                          >
                            {isCredit ? 'CR' : 'DR'}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: colour }}>
                          {isCredit ? '+' : '-'}
                          {formatPrice(Math.abs(entry.amount))}
                        </td>
                        <td style={td}>{entry.reason}</td>
                        <td style={{ ...td, fontFamily: MONO, fontSize: '12px' }}>
                          {entry.orderId || '—'}
                          {entry.returnId ? <div style={{ color: 'var(--admin-text-muted)' }}>{entry.returnId}</div> : null}
                        </td>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{entry.createdBy || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : !lookupError && !looking ? (
        <div style={{ ...tableFrame, marginTop: '16px' }}>
          <EmptyState
            title="No customer selected"
            description="Search by email or UID above to see a customer's store credit balance and history."
          />
        </div>
      ) : null}
    </div>
  );
}
