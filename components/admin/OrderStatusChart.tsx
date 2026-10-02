'use client';
/**
 * OrderStatusChart — order counts per status with thin progress bars. Plain styled divs, no chart library.
 */
import Link from 'next/link';

interface OrderStatusChartProps {
  statuses: { status: string; count: number; percentage: number }[];
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
const SERIF = 'var(--font-newsreader), Georgia, serif';

/** Same foreground colours as StatusBadge. */
const STATUS_FG: Record<string, string> = {
  pending: '#8A6100',
  confirmed: '#2F5577',
  processing: '#553C8B',
  ready_to_ship: '#8A4500',
  shipped: '#1E6B45',
  delivered: '#185C24',
  cancelled: '#9A3B1E',
};

function toLabel(status: string): string {
  const words = status.replace(/[\s-]+/g, '_').split('_').filter(Boolean);
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function OrderStatusChart({ statuses }: OrderStatusChartProps) {
  const total = statuses.reduce((sum, s) => sum + s.count, 0);

  return (
    <div
      style={{
        background: 'var(--admin-surface)',
        border: '1px solid var(--admin-border)',
        padding: 24,
        fontFamily: SANS,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 400, margin: 0, color: 'var(--admin-text)' }}>
          Order Status
        </h2>
        <Link href="/admin/orders" style={{ fontSize: 12, color: 'var(--admin-gold)', textDecoration: 'none' }}>
          View all orders →
        </Link>
      </div>

      {total === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', margin: '24px 0', textAlign: 'center' }}>
          No orders yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {statuses.map(({ status, count, percentage }) => {
            const colour = STATUS_FG[status.toLowerCase()] ?? '#555555';
            return (
              <li key={status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, color: 'var(--admin-text)' }}>{toLabel(status)}</span>
                  <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{count}</span>
                  <span style={{ width: 48, textAlign: 'right', color: 'var(--admin-text-muted)', fontSize: 12 }}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 3, background: 'var(--admin-border-light)', marginTop: 8, marginLeft: 18 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, percentage))}%`, background: colour }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
