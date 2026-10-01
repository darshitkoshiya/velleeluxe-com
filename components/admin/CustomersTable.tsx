'use client';

import { useCallback, useMemo, useState } from 'react';
import CustomerDrawer from '@/components/admin/CustomerDrawer';
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
const secondaryButton: React.CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  color: '#1C2230',
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};
const input: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxSizing: 'border-box',
  background: '#fff',
  fontFamily: 'inherit',
};

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
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search customers by name or email"
        style={{ ...input, marginBottom: '16px' }}
      />

      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={{ ...th, textAlign: 'right' }}>Orders</th>
              <th style={{ ...th, textAlign: 'right' }}>Total Spent</th>
              <th style={th}>Last Order</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={6}>
                  No orders placed yet.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#6F6A62' }} colSpan={6}>
                  No customers match &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr
                  key={customer.email}
                  onClick={() => setSelectedEmail(customer.email)}
                  style={{ cursor: 'pointer', background: selectedEmail === customer.email ? '#FAF8F4' : undefined }}
                  title="View customer details"
                >
                  <td style={td}>
                    {customer.name || '—'}
                    {customer.phone ? (
                      <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>+91 {customer.phone}</div>
                    ) : null}
                    {!customer.uid ? (
                      <div style={{ fontSize: '12px', color: '#6F6A62', marginTop: '2px' }}>Guest</div>
                    ) : null}
                  </td>
                  <td style={{ ...td, wordBreak: 'break-all' }}>{customer.email}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{customer.orderCount}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatPrice(customer.totalSpent)}
                    {customer.storeCredit ? (
                      <div style={{ fontSize: '12px', color: '#1E6B45', marginTop: '2px' }}>
                        Credit: {formatPrice(customer.storeCredit)}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }} title={customer.lastOrderAt}>
                    {relativeTime(customer.lastOrderAt)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <a
                      href={`/admin/orders?email=${encodeURIComponent(customer.email)}`}
                      onClick={(event) => event.stopPropagation()}
                      style={secondaryButton}
                    >
                      View Orders
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomerDrawer email={selectedEmail} onClose={closeDrawer} />
    </div>
  );
}
