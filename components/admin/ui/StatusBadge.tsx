/**
 * StatusBadge — small coloured pill for order / product / stock statuses.
 */
import type { CSSProperties } from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLOURS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FFF4D6', fg: '#8A6100' },
  confirmed: { bg: '#E3EDF7', fg: '#2F5577' },
  processing: { bg: '#EDE7F6', fg: '#553C8B' },
  ready_to_ship: { bg: '#FFF0E0', fg: '#8A4500' },
  shipped: { bg: '#E0F2E9', fg: '#1E6B45' },
  delivered: { bg: '#D6EFD8', fg: '#185C24' },
  cancelled: { bg: '#F5E1DA', fg: '#9A3B1E' },
  active: { bg: '#D6EFD8', fg: '#185C24' },
  draft: { bg: '#F0F0F0', fg: '#555555' },
  archived: { bg: '#F0E8D6', fg: '#7A5C2E' },
  low_stock: { bg: '#FFF0E0', fg: '#8A4500' },
  out_of_stock: { bg: '#F5E1DA', fg: '#9A3B1E' },
};

const FALLBACK = { bg: '#F0F0F0', fg: '#555555' };

/** Words kept lowercase in labels unless they are the first word. */
const MINOR_WORDS = new Set(['to', 'of', 'and', 'a', 'in', 'on', 'for']);

/** "Ready to ship", "ready-to-ship", "READY_TO_SHIP" -> "ready_to_ship". */
function normaliseStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** "ready_to_ship" -> "Ready to Ship". */
function toLabel(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = normaliseStatus(status || '');
  const colours = STATUS_COLOURS[key] ?? FALLBACK;
  const label = toLabel(key) || '—';

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    background: colours.bg,
    color: colours.fg,
    fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
    fontWeight: 500,
    fontSize: size === 'sm' ? '11px' : '12px',
    lineHeight: 1.4,
    letterSpacing: '0.02em',
    padding: size === 'sm' ? '2px 8px' : '4px 10px',
    borderRadius: '999px',
  };

  return <span style={style}>{label}</span>;
}
