/**
 * Shared inline-style tokens for the redesigned admin pages (catalog, families, inventory).
 * Plain module (no 'use client') so both server and client components can import it.
 */
import type { CSSProperties } from 'react';

export const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
export const SERIF = 'var(--font-newsreader), Georgia, serif';
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const INK = '#0F1623';
export const CREAM = '#F5F0E8';
export const PLACEHOLDER_BG = '#F0EBE0';
export const DANGER = '#9A3B1E';
export const DANGER_BG = '#F5E1DA';
export const DANGER_BORDER = '#E8C9BE';
export const WARN = '#8A4500';
export const WARN_BG = '#FFF0E0';
export const OK = '#1E6B45';

/** CSS that inline styles cannot express (hover states). Render once per page in a <style> tag. */
export const ADMIN_TABLE_CSS = `
.vl-row { transition: background-color 120ms ease; }
.vl-row:hover { background: #FDFAF6; }
.vl-link-row { cursor: pointer; }
.vl-thumb:hover { outline: 2px solid var(--admin-gold); outline-offset: 1px; }
`;

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost';

/** Button style. `size` sm is for in-table actions. Works for <button> and <Link>. */
export function btn(kind: ButtonKind, opts: { disabled?: boolean; size?: 'sm' | 'md' } = {}): CSSProperties {
  const { disabled = false, size = 'md' } = opts;
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: SANS,
    fontSize: size === 'sm' ? '12px' : '13px',
    fontWeight: 500,
    letterSpacing: '0.02em',
    lineHeight: 1.2,
    padding: size === 'sm' ? '6px 10px' : '10px 18px',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
  switch (kind) {
    case 'primary':
      return { ...base, background: INK, color: CREAM, border: `1px solid ${INK}` };
    case 'secondary':
      return { ...base, background: '#FFFFFF', color: INK, border: `1px solid ${INK}` };
    case 'danger':
      return { ...base, background: DANGER, color: '#FFFFFF', border: `1px solid ${DANGER}` };
    case 'dangerOutline':
      return { ...base, background: '#FFFFFF', color: DANGER, border: `1px solid ${DANGER}` };
    case 'ghost':
    default:
      return { ...base, background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' };
  }
}

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--admin-surface)',
  fontFamily: SANS,
};

export const tableFrame: CSSProperties = {
  border: '1px solid var(--admin-border)',
  borderRadius: '8px',
  overflowX: 'auto',
  background: 'var(--admin-surface)',
};

export const th: CSSProperties = {
  background: '#F9F6F0',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--admin-text-muted)',
  padding: '10px 12px',
  borderBottom: '1px solid var(--admin-border)',
  whiteSpace: 'nowrap',
};

export const td: CSSProperties = {
  height: '44px',
  padding: '6px 12px',
  borderBottom: '1px solid var(--admin-border-light)',
  fontSize: '13px',
  color: 'var(--admin-text)',
  verticalAlign: 'middle',
};

/** Small uppercase label used as a section divider. */
export const sectionLabel: CSSProperties = {
  fontFamily: SANS,
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--admin-text-muted)',
  margin: 0,
};

export const card: CSSProperties = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '8px',
  padding: '16px',
};

export const fieldLabel: CSSProperties = {
  display: 'block',
  fontFamily: SANS,
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--admin-text-muted)',
  margin: '0 0 6px',
};

export const fieldInput: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  fontSize: '14px',
  fontFamily: SANS,
  color: 'var(--admin-text)',
  background: '#FFFFFF',
  border: '1px solid var(--admin-border)',
  borderRadius: '6px',
  outline: 'none',
};

export const cellInput: CSSProperties = {
  ...fieldInput,
  width: '70px',
  padding: '5px 7px',
  fontSize: '12px',
};

/** Small pill used for counts and filters. */
export function chip(active = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '999px',
    fontFamily: SANS,
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    background: active ? INK : 'var(--admin-surface)',
    color: active ? CREAM : 'var(--admin-text-muted)',
    border: `1px solid ${active ? INK : 'var(--admin-border)'}`,
  };
}

/** Neutral count badge, e.g. "4 sizes". */
export const countBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '999px',
  background: '#F3EEE4',
  color: 'var(--admin-text-muted)',
  fontSize: '11px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

export function swatch(colorCode: string | undefined, size = 10): CSSProperties {
  return {
    display: 'inline-block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: colorCode?.trim() || '#999',
    border: '1px solid rgba(0,0,0,0.12)',
    flexShrink: 0,
  };
}

export const errorText: CSSProperties = { margin: 0, fontSize: '13px', color: DANGER, fontFamily: SANS };

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Stock-level badge colours: 0 = red, 1-5 = orange, else muted. */
export function stockTone(qty: number): { bg: string; fg: string } {
  if (qty <= 0) return { bg: DANGER_BG, fg: DANGER };
  if (qty <= 5) return { bg: WARN_BG, fg: WARN };
  return { bg: '#E0F2E9', fg: OK };
}
