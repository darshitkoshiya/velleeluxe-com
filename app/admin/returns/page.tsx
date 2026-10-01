'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReturnStatusPill } from '@/components/admin/ReturnStatusPill';
import { RETURN_STATUS_LABELS, RETURN_TYPE_LABELS } from '@/lib/returns-shared';
import type { ReturnRequest, ReturnStatus } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

type Filter = 'all' | ReturnStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Under Review' },
  { value: 'requested', label: 'Approved' },
  { value: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { value: 'received', label: 'Received' },
  { value: 'inspecting', label: 'Inspecting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 25;

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
  textDecoration: 'none',
  display: 'inline-block',
};
const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: '#fff',
  color: '#1C2230',
  border: '1px solid #ccc',
};

export default function AdminReturnsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReturns = useCallback(async (status: Filter, pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(pageNumber), pageSize: String(PAGE_SIZE) });
      if (status !== 'all') query.set('status', status);
      const response = await fetch(`/api/admin/returns?${query.toString()}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as {
        returns?: ReturnRequest[];
        total?: number;
        hasMore?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Could not load returns.');
      setReturns(data.returns ?? []);
      setTotal(data.total ?? 0);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load returns.');
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReturns(filter, page);
  }, [filter, page, loadReturns]);

  const openReturn = (returnId: string) => {
    window.location.href = `/admin/returns/${encodeURIComponent(returnId)}`;
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Returns &amp; Exchanges</h1>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }} role="tablist" aria-label="Filter by status">
        {FILTERS.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(option.value);
                setPage(1);
              }}
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
        <button type="button" onClick={() => void loadReturns(filter, page)} style={{ ...secondaryButton, marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ background: '#F5E1DA', color: '#9A3B1E', padding: '12px 16px', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </p>
      ) : null}

      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
          <thead>
            <tr>
              <th style={th}>Return ID</th>
              <th style={th}>Customer</th>
              <th style={th}>Product</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={7}>
                  Loading returns…
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={7}>
                  No return requests {filter === 'all' ? 'yet' : `with status "${RETURN_STATUS_LABELS[filter]}"`}.
                </td>
              </tr>
            ) : (
              returns.map((item) => (
                <tr
                  key={item.returnId}
                  onClick={() => openReturn(item.returnId)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ ...td, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                    {item.returnId}
                    <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>{item.orderId}</div>
                  </td>
                  <td style={td}>
                    {item.customerName || '—'}
                    <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px', wordBreak: 'break-all' }}>{item.customerEmail}</div>
                  </td>
                  <td style={td}>
                    {item.itemProductName}
                    <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>
                      Size {item.itemSize}
                      {item.requestedSize ? ` → ${item.requestedSize}` : ''} · {formatPrice(item.itemPrice || 0)}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {RETURN_TYPE_LABELS[item.type] ?? item.type}
                    <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>
                      {item.paymentMethod === 'cod' ? 'COD order' : 'Paid online'}
                    </div>
                  </td>
                  <td style={td}>
                    <ReturnStatusPill status={item.status} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateTime(item.createdAt)}</td>
                  <td style={td}>
                    <a
                      href={`/admin/returns/${encodeURIComponent(item.returnId)}`}
                      style={primaryButton}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', fontSize: '14px', color: '#6F6A62' }}>
          <span>
            Page {page} · {total} requests
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={secondaryButton} disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <button type="button" style={secondaryButton} disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
