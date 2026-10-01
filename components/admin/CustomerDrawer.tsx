'use client';

import { useEffect, useState } from 'react';
import type { CustomerDetail } from '@/lib/customers';
import type { OrderStatus } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';

const STATUS_COLOURS: Record<OrderStatus, { bg: string; fg: string }> = {
  pending: { bg: '#FFF4D6', fg: '#8A6A00' },
  confirmed: { bg: '#E3EDF7', fg: '#2F5577' },
  processing: { bg: '#EDE7F6', fg: '#5B3F8C' },
  shipped: { bg: '#E0F2F1', fg: '#1F6B66' },
  delivered: { bg: '#E3F3E9', fg: '#1E6B45' },
  cancelled: { bg: '#FBE4E4', fg: '#9B2C2C' },
};

const sectionTitle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6A62',
  margin: '0 0 10px',
};
const section: React.CSSProperties = { borderTop: '1px solid #f0f0f0', paddingTop: '20px', marginTop: '20px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#6F6A62' };
const button: React.CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  color: '#1C2230',
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};

function shortDate(iso: string | undefined): string {
  return iso ? formatDate(iso) || '—' : '—';
}

export default function CustomerDrawer({ email, onClose }: { email: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<{ sending: boolean; message?: string; error?: string }>({ sending: false });

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setResetState({ sending: false });
    setLoading(true);
    fetch(`/api/admin/customers/${encodeURIComponent(email)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as CustomerDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load this customer.');
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this customer.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    if (!email) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [email, onClose]);

  if (!email) return null;

  const sendReset = async () => {
    setResetState({ sending: true });
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(email)}/reset-password`, { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not send the reset email.');
      setResetState({ sending: false, message: `Reset email sent to ${email}` });
    } catch (err) {
      setResetState({ sending: false, error: err instanceof Error ? err.message : 'Could not send the reset email.' });
    }
  };

  const customer = detail?.customer;
  const lastOrderAt = detail?.orders[0]?.createdAt ?? customer?.lastOrderAt;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(28, 34, 48, 0.35)', zIndex: 99 }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Customer details for ${email}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          background: '#fff',
          borderLeft: '1px solid #e5e5e5',
          zIndex: 100,
          overflowY: 'auto',
          padding: '24px',
          color: '#1C2230',
        }}
      >
        {/* 1. Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>{customer?.name || (loading ? 'Loading…' : '—')}</h2>
            <div style={{ ...muted, wordBreak: 'break-all' }}>{email}</div>
            {customer?.phone ? <div style={{ ...muted, marginTop: '2px' }}>+91 {customer.phone}</div> : null}
            {customer && !customer.uid ? <div style={{ ...muted, marginTop: '2px' }}>Guest</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '26px', lineHeight: 1, cursor: 'pointer', color: '#6F6A62', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: '20px', background: '#FBE4E4', color: '#9B2C2C', padding: '10px 14px', borderRadius: '6px', fontSize: '14px' }}>
            {error}
          </div>
        ) : null}

        {loading && !detail ? <p style={{ ...muted, marginTop: '20px' }}>Loading customer…</p> : null}

        {detail && customer ? (
          <>
            {/* 2. Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '20px' }}>
              {[
                { label: 'Orders', value: String(customer.orderCount) },
                { label: 'Total Spent', value: formatPrice(customer.totalSpent) },
                { label: 'Last Order', value: shortDate(lastOrderAt) },
              ].map((stat) => (
                <div key={stat.label} style={{ background: '#FAF8F4', border: '1px solid #f0ece4', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#6F6A62', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* 3. Store credit */}
            <div style={section}>
              <h3 style={sectionTitle}>Store Credit</h3>
              {customer.uid ? (
                <>
                  <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>
                    Balance: {formatPrice(detail.storeCredit.balance)}
                  </div>
                  {detail.storeCredit.transactions.length === 0 ? (
                    <p style={{ ...muted, margin: '0 0 12px' }}>No transactions yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                      {detail.storeCredit.transactions.map((entry) => (
                        <li
                          key={entry.id}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#6F6A62', fontSize: '12px' }}>{shortDate(entry.createdAt)}</div>
                            <div style={{ wordBreak: 'break-word' }}>{entry.reason}</div>
                          </div>
                          <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: entry.type === 'credit' ? '#1E6B45' : '#9B2C2C' }}>
                            {entry.type === 'credit' ? '+' : '−'}
                            {formatPrice(entry.amount)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <a href={`/admin/store-credit?uid=${encodeURIComponent(customer.uid)}`} style={button}>
                    View all transactions{detail.storeCredit.totalTransactions > 0 ? ` (${detail.storeCredit.totalTransactions})` : ''}
                  </a>
                </>
              ) : (
                <p style={{ ...muted, margin: 0 }}>Guest checkout — no store credit account</p>
              )}
            </div>

            {/* 4. Refunds */}
            <div style={section}>
              <h3 style={sectionTitle}>Refunds</h3>
              {detail.totalRefundedToSource === 0 && detail.totalRefundedAsCredit === 0 ? (
                <p style={{ ...muted, margin: 0 }}>None</p>
              ) : (
                <div style={{ fontSize: '14px', display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Refunded to payment source</span>
                    <strong>{formatPrice(detail.totalRefundedToSource)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Refunded as store credit</span>
                    <strong>{formatPrice(detail.totalRefundedAsCredit)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Order history */}
            <div style={section}>
              <h3 style={sectionTitle}>Order History ({detail.orders.length})</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {detail.orders.map((order) => {
                  const colours = STATUS_COLOURS[order.status] ?? { bg: '#eee', fg: '#444' };
                  const itemCount = (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  return (
                    <li key={order.orderId} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <a
                          href={`/admin/orders?search=${encodeURIComponent(order.orderId)}`}
                          style={{ color: '#1C2230', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          {order.orderId}
                        </a>
                        <span
                          style={{
                            background: colours.bg,
                            color: colours.fg,
                            borderRadius: '999px',
                            padding: '2px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#6F6A62' }}>
                        <span>
                          {shortDate(order.createdAt)} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <span style={{ color: '#1C2230', fontWeight: 500 }}>{formatPrice(Number(order.total) || 0)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 6. Account actions */}
            <div style={section}>
              <h3 style={sectionTitle}>Account Actions</h3>
              <button type="button" onClick={sendReset} disabled={resetState.sending} style={{ ...button, opacity: resetState.sending ? 0.6 : 1 }}>
                {resetState.sending ? 'Sending…' : 'Send Password Reset Email'}
              </button>
              {resetState.message ? (
                <p style={{ fontSize: '13px', color: '#1E6B45', margin: '8px 0 0', wordBreak: 'break-all' }}>{resetState.message}</p>
              ) : null}
              {resetState.error ? <p style={{ fontSize: '13px', color: '#9B2C2C', margin: '8px 0 0' }}>{resetState.error}</p> : null}
              <p style={{ ...muted, fontSize: '12px', margin: '8px 0 0' }}>Passwords are stored hashed and cannot be viewed.</p>
            </div>

            {/* 7. Support tickets (placeholder) */}
            <div style={section}>
              <h3 style={sectionTitle}>Support Tickets</h3>
              <div style={{ background: '#f5f5f5', color: '#6F6A62', borderRadius: '6px', padding: '14px', fontSize: '13px', textAlign: 'center' }}>
                Support ticket history coming soon
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
