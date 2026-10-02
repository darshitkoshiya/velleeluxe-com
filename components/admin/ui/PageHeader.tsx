/**
 * PageHeader — title, optional subtitle, breadcrumbs and right-aligned actions for admin pages.
 */
import Link from 'next/link';
import { Fragment } from 'react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
const SERIF = 'var(--font-newsreader), Georgia, serif';

export default function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: '28px' }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
            fontFamily: SANS,
            fontSize: '12px',
            color: 'var(--admin-text-subtle)',
          }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} style={{ color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ color: isLast ? 'var(--admin-text)' : 'var(--admin-text-muted)' }}>{crumb.label}</span>
                )}
                {!isLast && <span aria-hidden="true">›</span>}
              </Fragment>
            );
          })}
        </nav>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: '28px',
              lineHeight: 1.2,
              color: 'var(--admin-text)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontFamily: SANS,
                fontSize: '14px',
                color: 'var(--admin-text-muted)',
                margin: '6px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>{actions}</div>
        )}
      </div>
    </div>
  );
}
