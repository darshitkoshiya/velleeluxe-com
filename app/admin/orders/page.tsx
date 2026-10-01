'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

type Filter = 'all' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

const STATUS_COLOURS: Record<OrderStatus, { bg: string; fg: string }> = {
  pending: { bg: '#FFF4D6', fg: '#8A6100' },
  confirmed: { bg: '#E3EDF7', fg: '#2F5577' },
  processing: { bg: '#EDE7F6', fg: '#553C8B' },
  shipped: { bg: '#E0F2E9', fg: '#1E6B45' },
  delivered: { bg: '#D6EFD8', fg: '#185C24' },
  cancelled: { bg: '#F5E1DA', fg: '#9A3B1E' },
};

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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6A62',
  borderBottom: '1px solid #e5e5e5',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' };
const primaryButton: React.CSSProperties = {
  background: '#1C2230',
  color: '#F6F1E8',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: '#fff',
  color: '#1C2230',
  border: '1px solid #ccc',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxSizing: 'border-box',
  marginTop: '6px',
};

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

  const visibleOrders = orders.filter(
    (order) =>
      (!emailFilter || (order.customerEmail ?? '').trim().toLowerCase() === emailFilter) &&
      (!orderIdFilter || (order.orderId ?? '').toUpperCase() === orderIdFilter),
  );

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

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Orders</h1>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }} role="tablist" aria-label="Filter by status">
        {FILTERS.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.value)}
              style={{
                ...secondaryButton,
                background: active ? '#1C2230' : '#fff',
                color: active ? '#F6F1E8' : '#1C2230',
                borderColor: active ? '#1C2230' : '#ccc',
              }}
            >
              {option.label}
            </button>
          );
        })}
        <button type="button" onClick={() => void loadOrders(filter)} style={{ ...secondaryButton, marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      {emailFilter || orderIdFilter ? (
        <div
          style={{ background: '#E3EDF7', color: '#2F5577', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
        >
          <span style={{ wordBreak: 'break-all' }}>
            {orderIdFilter ? (
              <>Showing order <strong>{orderIdFilter}</strong></>
            ) : (
              <>Showing orders for <strong>{emailFilter}</strong></>
            )}
          </span>
          <button type="button" onClick={clearEmailFilter} style={{ ...secondaryButton, padding: '6px 12px' }}>
            {orderIdFilter ? 'Show all orders' : 'Show all customers'}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          style={{ background: '#E0F2E9', color: '#1E6B45', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ background: '#F5E1DA', color: '#9A3B1E', padding: '12px 16px', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </p>
      ) : null}

      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
          <thead>
            <tr>
              <th style={th}>Order ID</th>
              <th style={th}>Customer</th>
              <th style={th}>Email</th>
              <th style={th}>Items</th>
              <th style={th}>Total</th>
              <th style={th}>Payment</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={9}>
                  Loading orders…
                </td>
              </tr>
            ) : visibleOrders.length === 0 ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={9}>
                  No orders {filter === 'all' ? 'yet' : `with status "${filter}"`}
                  {emailFilter ? ` for ${emailFilter}` : ''}.
                </td>
              </tr>
            ) : (
              visibleOrders.map((order) => {
                const colours = STATUS_COLOURS[order.status] ?? { bg: '#eee', fg: '#333' };
                const canShip = order.status === 'confirmed' || order.status === 'processing';
                return (
                  <tr key={order.orderId}>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>{order.orderId}</td>
                    <td style={td}>
                      {order.customerName}
                      {order.customerPhone ? (
                        <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>+91 {order.customerPhone}</div>
                      ) : null}
                    </td>
                    <td style={{ ...td, wordBreak: 'break-all' }}>{order.customerEmail}</td>
                    <td style={td}>{itemCount(order)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {formatPrice(order.total || 0)}
                      {(order.storeCreditApplied ?? 0) > 0 ? (
                        <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>
                          Store credit: −{formatPrice(order.storeCreditApplied ?? 0)}
                        </div>
                      ) : null}
                      {(order.discountAmount ?? 0) > 0 ? (
                        <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>
                          Discount{order.discountCode ? ` (${order.discountCode})` : ''}: −{formatPrice(order.discountAmount ?? 0)}
                        </div>
                      ) : null}
                      <div style={{ fontSize: '12px', color: '#1C2230', fontWeight: 600, marginTop: '4px' }}>
                        Charged to payment: {formatPrice(order.amountChargedToPayment ?? (order.total || 0))}
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          background: colours.bg,
                          color: colours.fg,
                        }}
                      >
                        {order.status}
                      </span>
                      {order.shippingInfo && (order.shippingInfo.courier || order.shippingInfo.trackingNumber) ? (
                        <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '4px' }}>
                          {[order.shippingInfo.courier, order.shippingInfo.trackingNumber].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateTime(order.createdAt)}</td>
                    <td style={td}>
                      {canShip ? (
                        <button type="button" style={primaryButton} onClick={() => openShipModal(order)}>
                          Mark as Shipped
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
            background: 'rgba(28, 34, 48, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: '#fff', borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '420px' }}
          >
            <h2 id="ship-modal-title" style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px' }}>
              Mark as Shipped
            </h2>
            <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 20px' }}>
              Order {shipping.orderId} for {shipping.customerName}. The customer will get a “your order has shipped” email.
            </p>

            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '14px' }}>
              Courier name <span style={{ color: '#6F6A62', fontWeight: 400 }}>(optional)</span>
              <input
                type="text"
                value={courier}
                onChange={(event) => setCourier(event.target.value)}
                placeholder="e.g. Delhivery, Blue Dart"
                style={input}
                autoFocus
              />
            </label>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>
              Tracking number <span style={{ color: '#6F6A62', fontWeight: 400 }}>(optional)</span>
              <input
                type="text"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="e.g. 1234567890"
                style={input}
              />
            </label>

            {modalError ? (
              <p role="alert" style={{ color: '#9A3B1E', fontSize: '14px', margin: '0 0 16px' }}>
                {modalError}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" style={secondaryButton} onClick={closeShipModal} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                style={{ ...primaryButton, opacity: submitting ? 0.6 : 1 }}
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
