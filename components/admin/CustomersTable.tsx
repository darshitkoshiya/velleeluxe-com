'use client';

import { useCallback, useMemo, useState } from 'react';
import CustomerDrawer from '@/components/admin/CustomerDrawer';
import EmptyState from '@/components/admin/ui/EmptyState';
import {
  ADMIN_TABLE_CSS,
  OK,
  btn,
  countBadge,
  fieldInput,
  formatDate,
  tableFrame,
  tableStyle,
  td,
  th,
} from '@/components/admin/ui/admin-styles';
import type { CustomerSummary } from '@/lib/customers';
import { formatPrice } from '@/lib/utils';

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const diff = Date.now() - time;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

const subText = { fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' } as const;

export default function CustomersTable({ customers }: { customers: CustomerSummary[] }) {
  const [query, setQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setSelectedEmail(null), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <div>
      <style>{ADMIN_TABLE_CSS}</style>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search customers by name or email"
        style={{ ...fieldInput, width: '280px', maxWidth: '100%', fontSize: '13px', marginBottom: '16px' }}
      />

      <div style={tableFrame}>
        {customers.length === 0 ? (
          <EmptyState title="No customers yet." description="Customers appear here after they place their first order." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No customers match"
            description={`Nothing matches “${query.trim()}”.`}
            action={
              <button type="button" onClick={() => setQuery('')} style={btn('secondary')}>
                Clear search
              </button>
            }
          />
        ) : (
          <table style={{ ...tableStyle, minWidth: '860px' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Phone</th>
                <th style={{ ...th, textAlign: 'right' }}>Orders</th>
                <th style={{ ...th, textAlign: 'right' }}>Total spent</th>
                <th style={th}>Joined</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.email}
                  className="vl-row vl-link-row"
                  onClick={() => setSelectedEmail(customer.email)}
                  style={{ background: selectedEmail === customer.email ? '#FDFAF6' : undefined }}
                  title="View customer details"
                >
                  <td style={td}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEmail(customer.email);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 500,
                        color: 'var(--admin-text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textDecorationColor: 'var(--admin-border)',
                        textUnderlineOffset: '3px',
                      }}
                    >
                      {customer.name || '—'}
                    </button>
                    {!customer.uid ? (
                      <div style={{ marginTop: '3px' }}>
                        <span style={countBadge}>Guest</span>
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...td, wordBreak: 'break-all' }}>{customer.email}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: customer.phone ? undefined : 'var(--admin-text-subtle)' }}>
                    {customer.phone ? `+91 ${customer.phone}` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{customer.orderCount}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{formatPrice(customer.totalSpent)}</div>
                    {customer.storeCredit ? (
                      <div style={{ ...subText, color: OK }}>Credit {formatPrice(customer.storeCredit)}</div>
                    ) : null}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div>{formatDate(customer.firstOrderAt)}</div>
                    <div style={subText} title={customer.lastOrderAt}>
                      Last order {relativeTime(customer.lastOrderAt).toLowerCase()}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <a
                      href={`/admin/orders?email=${encodeURIComponent(customer.email)}`}
                      onClick={(event) => event.stopPropagation()}
                      style={btn('secondary', { size: 'sm' })}
                    >
                      View Orders
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerDrawer email={selectedEmail} onClose={closeDrawer} />
    </div>
  );
}
