'use client';

/**
 * AdminHeader — top bar above admin content: context slot, search (UI only), notifications, avatar.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

interface AdminHeaderProps {
  notificationCount?: number;
  /** Optional page context / breadcrumb shown on the left. */
  context?: ReactNode;
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';

export default function AdminHeader({ notificationCount = 0, context }: AdminHeaderProps) {
  const badge = notificationCount > 99 ? '99+' : String(notificationCount);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: 'var(--admin-header-height)',
        flexShrink: 0,
        background: '#FFFFFF',
        borderBottom: '1px solid var(--admin-border)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontFamily: SANS,
      }}
    >
      <div style={{ minWidth: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>{context}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <input
          type="search"
          aria-label="Search"
          placeholder="Search products, orders, SKU..."
          style={{
            width: '240px',
            border: '1px solid var(--admin-border)',
            borderRadius: '2px',
            padding: '8px',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--admin-text)',
            background: '#FFFFFF',
            outline: 'none',
          }}
        />

        <Link
          href="/admin/notifications"
          aria-label={notificationCount > 0 ? `Notifications (${notificationCount} unread)` : 'Notifications'}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            color: 'var(--admin-text-muted)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '0px',
                minWidth: '16px',
                height: '16px',
                padding: '0 4px',
                borderRadius: '999px',
                background: 'var(--admin-gold)',
                color: '#0F1623',
                fontSize: '9px',
                fontWeight: 600,
                lineHeight: '16px',
                textAlign: 'center',
              }}
            >
              {badge}
            </span>
          )}
        </Link>

        <div
          aria-label="Admin"
          title="Admin"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--admin-sidebar-bg)',
            color: '#F5F0E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          A
        </div>
      </div>
    </header>
  );
}
