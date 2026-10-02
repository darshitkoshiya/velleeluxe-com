'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ReturnStatusPill } from '@/components/admin/ReturnStatusPill';
import PageHeader from '@/components/admin/ui/PageHeader';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  DANGER,
  DANGER_BG,
  DANGER_BORDER,
  MONO,
  SANS,
  btn,
  chip,
  countBadge,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, RETURN_TYPE_LABELS } from '@/lib/returns-shared';
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

const subText: CSSProperties = { fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' };

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
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_TABLE_CSS}</style>

      <PageHeader
        title="Returns & Exchanges"
        subtitle={loading ? 'Loading requests…' : `${total} ${total === 1 ? 'request' : 'requests'}`}
        actions={
          <button type="button" onClick={() => void loadReturns(filter, page)} style={btn('secondary')} disabled={loading}>
            Refresh
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }} role="tablist" aria-label="Filter by status">
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
              style={{ ...chip(active), cursor: 'pointer', padding: '6px 14px' }}
            >
              {option.label}
              {active && !loading ? (
                <span style={{ ...countBadge, padding: '0 7px', background: 'rgba(245, 240, 232, 0.18)', color: 'inherit' }}>
                  {total}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            background: DANGER_BG,
            color: DANGER,
            border: `1px solid ${DANGER_BORDER}`,
            borderRadius: '6px',
            padding: '10px 16px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={tableFrame}>
        {loading ? (
          <p style={{ margin: 0, padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
            Loading returns…
          </p>
        ) : returns.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No returns yet' : `No ${RETURN_STATUS_LABELS[filter].toLowerCase()} returns`}
            description={
              filter === 'all'
                ? 'Returns submitted by customers will appear here.'
                : `There are no return requests with status “${RETURN_STATUS_LABELS[filter]}”.`
            }
          />
        ) : (
          <table style={{ ...tableStyle, minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={th}>Return #</th>
                <th style={th}>Order #</th>
                <th style={th}>Customer</th>
                <th style={th}>Item</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((item) => (
                <tr key={item.returnId} className="vl-row vl-link-row" onClick={() => openReturn(item.returnId)}>
                  <td style={{ ...td, fontFamily: MONO, fontSize: '12px', whiteSpace: 'nowrap' }}>{item.returnId}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>
                    {item.orderId}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{item.customerName || '—'}</div>
                    <div style={{ ...subText, wordBreak: 'break-all' }}>{item.customerEmail}</div>
                  </td>
                  <td style={td}>
                    <div>{item.itemProductName}</div>
                    <div style={subText}>
                      Size {item.itemSize}
                      {item.requestedSize ? ` → ${item.requestedSize}` : ''} · {formatPrice(item.itemPrice || 0)}
                    </div>
                  </td>
                  <td style={td}>
                    <div>{RETURN_REASON_LABELS[item.reason] ?? item.reason ?? '—'}</div>
                    <div style={subText}>
                      {RETURN_TYPE_LABELS[item.type] ?? item.type} · {item.paymentMethod === 'cod' ? 'COD order' : 'Paid online'}
                    </div>
                  </td>
                  <td style={td}>
                    <ReturnStatusPill status={item.status} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{formatDateTime(item.createdAt)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <a
                      href={`/admin/returns/${encodeURIComponent(item.returnId)}`}
                      style={btn('primary', { size: 'sm' })}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--admin-text-muted)',
          }}
        >
          <span>
            Page {page} · {total} requests
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              style={btn('secondary', { size: 'sm', disabled: page <= 1 || loading })}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              style={btn('secondary', { size: 'sm', disabled: !hasMore || loading })}
              disabled={!hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
