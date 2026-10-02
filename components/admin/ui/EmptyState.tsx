/**
 * EmptyState — quiet, centred placeholder for empty lists and tables.
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '60px 24px',
        fontFamily: SANS,
      }}
    >
      {icon && <div style={{ color: 'var(--admin-text-subtle)', marginBottom: '16px' }}>{icon}</div>}
      <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)', margin: 0 }}>{title}</p>
      {description && (
        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--admin-text-muted)',
            margin: '8px 0 0',
            maxWidth: '380px',
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}
