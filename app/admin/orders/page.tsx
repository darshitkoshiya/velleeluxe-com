'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Order } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  DANGER_BG,
  MONO,
  OK,
  SANS,
  SERIF,
  btn,
  chip,
  countBadge,
  fieldInput,
  fieldLabel,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';

type Filter = 'all' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

const subText: CSSProperties = { fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' };

function banner(tone: 'info' | 'ok' | 'error'): CSSProperties {
  const tones = {
    info: { bg: '#E3EDF7', fg: '#2F5577', border: '#C9D9EA' },
    ok: { bg: '#E0F2E9', fg: OK, border: '#BFE0CD' },
    error: { bg: DANGER_BG, fg: DANGER, border: '#E8C9BE' },
  }[tone];
  return {
    background: tones.bg,
    color: tones.fg,
    border: `1px solid ${tones.border}`,
    padding: '10px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontFamily: SANS,
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  };
}

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Optional ?email= filter (linked from /admin/customers).
  const [emailFilter, setEmailFilter] = useState('');
  // Optional ?search= order ID filter (linked from the customer drawer).
  const [orderIdFilter, setOrderIdFilter] = useState('');
  // Free-text search over the loaded orders (client-side only).
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email) setEmailFilter(email.trim().toLowerCase());
    const search = params.get('search');
    if (search) setOrderIdFilter(search.trim().toUpperCase());
  }, []);

  const clearEmailFilter = () => {
    setEmailFilter('');
    setOrderIdFilter('');
    const url = new URL(window.location.href);
    url.searchParams.delete('email');
    url.searchParams.delete('search');
    window.history.replaceState(null, '', url.toString());
  };

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (order) =>
        (!emailFilter || (order.customerEmail ?? '').trim().toLowerCase() === emailFilter) &&
        (!orderIdFilter || (order.orderId ?? '').toUpperCase() === orderIdFilter) &&
        (!q ||
          (order.orderId ?? '').toLowerCase().includes(q) ||
          (order.customerName ?? '').toLowerCase().includes(q) ||
          (order.customerEmail ?? '').toLowerCase().includes(q) ||
          (order.customerPhone ?? '').toLowerCase().includes(q)),
    );
  }, [orders, emailFilter, orderIdFilter, search]);

  // "Mark as Shipped" modal
  const [shipping, setShipping] = useState<Order | null>(null);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadOrders = useCallback(async (status: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const query = status === 'all' ? '' : `?status=${status}`;
      const response = await fetch(`/api/admin/orders${query}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load orders.');
      setOrders(data.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(filter);
  }, [filter, loadOrders]);

  const openShipModal = (order: Order) => {
    setShipping(order);
    setCourier('');
    setTrackingNumber('');
    setModalError(null);
  };

  const closeShipModal = () => {
    if (submitting) return;
    setShipping(null);
  };

  const confirmShip = async () => {
    if (!shipping) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(shipping.orderId)}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier: courier.trim(), trackingNumber: trackingNumber.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; emailSent?: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not mark the order as shipped.');
      setNotice(
        data.emailSent === false
          ? `Order ${shipping.orderId} marked as shipped, but the email to the customer could not be sent.`
          : `Order ${shipping.orderId} marked as shipped. The customer has been emailed.`,
      );
      setShipping(null);
      await loadOrders(filter);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? filter;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>

      <PageHeader
        title="Orders"
        subtitle={loading ? 'Loading orders…' : `${visibleOrders.length} ${visibleOrders.length === 1 ? 'order' : 'orders'}${filter === 'all' ? '' : ` · ${filterLabel}`}`}
        actions={
          <button type="button" onClick={() => void loadOrders(filter)} style={btn('secondary')} disabled={loading}>
            Refresh
          </button>
        }
      />

      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }} role="tablist" aria-label="Filter by status">
          {FILTERS.map((option) => {
            const active = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option.value)}
                style={{ ...chip(active), cursor: 'pointer', padding: '6px 14px' }}
              >
                {option.label}
                {active && !loading ? (
                  <span
                    style={{
                      ...countBadge,
                      padding: '0 7px',
                      background: 'rgba(245, 240, 232, 0.18)',
                      color: 'inherit',
                    }}
                  >
                    {orders.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order ID, customer..."
          aria-label="Search orders"
          style={{ ...fieldInput, width: '280px', maxWidth: '100%', fontSize: '13px' }}
        />
      </div>

      {emailFilter || orderIdFilter ? (
        <div style={banner('info')}>
          <span style={{ wordBreak: 'break-all' }}>
            {orderIdFilter ? (
              <>Showing order <strong>{orderIdFilter}</strong></>
            ) : (
              <>Showing orders for <strong>{emailFilter}</strong></>
            )}
          </span>
          <button type="button" onClick={clearEmailFilter} style={btn('secondary', { size: 'sm' })}>
            {orderIdFilter ? 'Show all orders' : 'Show all customers'}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div role="status" style={banner('ok')}>
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" style={banner('error')}>
          {error}
        </div>
      ) : null}

      <div style={tableFrame}>
        {loading ? (
          <p style={{ margin: 0, padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
            Loading orders…
          </p>
        ) : visibleOrders.length === 0 ? (
          <EmptyState
            title={orders.length === 0 && filter === 'all' && !search ? 'No orders yet' : 'No orders match this filter'}
            description={
              search.trim()
                ? `Nothing matches “${search.trim()}”${filter === 'all' ? '' : ` in ${filterLabel} orders`}.`
                : filter === 'all'
                  ? emailFilter
                    ? `No orders found for ${emailFilter}.`
                    : 'Orders placed on the store will appear here.'
                  : `There are no ${filterLabel} orders${emailFilter ? ` for ${emailFilter}` : ''}.`
            }
            action={
              search.trim() ? (
                <button type="button" onClick={() => setSearch('')} style={btn('secondary')}>
                  Clear search
                </button>
              ) : undefined
            }
          />
        ) : (
          <table style={{ ...tableStyle, minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={th}>Order #</th>
                <th style={th}>Customer</th>
                <th style={{ ...th, textAlign: 'right' }}>Items</th>
                <th style={{ ...th, textAlign: 'right' }}>Total ₹</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const canShip = order.status === 'confirmed' || order.status === 'processing';
                const hasCredit = (order.storeCreditApplied ?? 0) > 0;
                const hasDiscount = (order.discountAmount ?? 0) > 0;
                return (
                  <tr key={order.orderId} className="vl-row">
                    <td style={{ ...td, fontFamily: MONO, fontSize: '12px', whiteSpace: 'nowrap' }}>{order.orderId}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{order.customerName || '—'}</div>
                      <div style={{ ...subText, wordBreak: 'break-all' }}>
                        {order.customerEmail}
                        {order.customerPhone ? ` · +91 ${order.customerPhone}` : ''}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{itemCount(order)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{formatPrice(order.total || 0)}</div>
                      {hasCredit ? <div style={subText}>Store credit −{formatPrice(order.storeCreditApplied ?? 0)}</div> : null}
                      {hasDiscount ? (
                        <div style={subText}>
                          Discount{order.discountCode ? ` (${order.discountCode})` : ''} −{formatPrice(order.discountAmount ?? 0)}
                        </div>
                      ) : null}
                      {hasCredit || hasDiscount ? (
                        <div style={{ ...subText, color: 'var(--admin-text)' }}>
                          Charged {formatPrice(order.amountChargedToPayment ?? (order.total || 0))}
                        </div>
                      ) : null}
                      <div style={subText}>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</div>
                    </td>
                    <td style={td}>
                      <StatusBadge status={order.status} size="sm" />
                      {order.shippingInfo && (order.shippingInfo.courier || order.shippingInfo.trackingNumber) ? (
                        <div style={{ ...subText, marginTop: '4px' }}>
                          {[order.shippingInfo.courier, order.shippingInfo.trackingNumber].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{formatDateTime(order.createdAt)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {canShip ? (
                        <button type="button" style={btn('primary', { size: 'sm' })} onClick={() => openShipModal(order)}>
                          Mark as Shipped
                        </button>
                      ) : (
                        <span style={{ color: 'var(--admin-text-subtle)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {shipping ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ship-modal-title"
          onClick={closeShipModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 22, 35, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '8px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              fontFamily: SANS,
            }}
          >
            <h2 id="ship-modal-title" style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 400, margin: '0 0 6px', color: 'var(--admin-text)' }}>
              Mark as Shipped
            </h2>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
              Order {shipping.orderId} for {shipping.customerName}. The customer will get a “your order has shipped” email.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="ship-courier" style={fieldLabel}>
                Courier name <span style={{ color: 'var(--admin-text-subtle)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="ship-courier"
                type="text"
                value={courier}
                onChange={(event) => setCourier(event.target.value)}
                placeholder="e.g. Delhivery, Blue Dart"
                style={fieldInput}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="ship-tracking" style={fieldLabel}>
                Tracking number <span style={{ color: 'var(--admin-text-subtle)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="ship-tracking"
                type="text"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="e.g. 1234567890"
                style={fieldInput}
              />
            </div>

            {modalError ? (
              <p role="alert" style={{ color: DANGER, fontSize: '13px', margin: '0 0 16px' }}>
                {modalError}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" style={btn('secondary', { disabled: submitting })} onClick={closeShipModal} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                style={btn('primary', { disabled: submitting })}
                onClick={() => void confirmShip()}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Confirm Shipped'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
