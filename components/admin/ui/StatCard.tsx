/**
 * StatCard — single KPI tile for admin dashboards. Becomes a link when `href` is given.
 */
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  change?: string; // e.g. "+12.5%"
  changePositive?: boolean;
  href?: string; // makes card clickable
  subtitle?: string; // small text below value
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';

const cardStyle: CSSProperties = {
  display: 'block',
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '2px',
  padding: '20px 24px',
  fontFamily: SANS,
  color: 'var(--admin-text)',
  textDecoration: 'none',
  height: '100%',
};

export default function StatCard({ label, value, icon, change, changePositive, href, subtitle }: StatCardProps) {
  const changeColour =
    changePositive === undefined ? 'var(--admin-text-muted)' : changePositive ? '#1E6B45' : '#9A3B1E';

  const body = (
    <>
      {icon && (
        <div
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--admin-text-muted)',
            marginBottom: '14px',
          }}
        >
          {icon}
        </div>
      )}
      <p
        style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 500,
          color: 'var(--admin-text-muted)',
          margin: 0,
        }}
      >
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
        <span style={{ fontSize: '28px', fontWeight: 600, lineHeight: 1.15, color: 'var(--admin-text)' }}>{value}</span>
        {change && <span style={{ fontSize: '12px', fontWeight: 500, color: changeColour }}>{change}</span>}
      </div>
      {subtitle && (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', margin: '6px 0 0' }}>{subtitle}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} style={cardStyle}>
        {body}
      </Link>
    );
  }
  return <div style={cardStyle}>{body}</div>;
}
