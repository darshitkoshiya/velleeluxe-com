/**
 * Square-edged inline-style tokens for admin form/settings pages
 * (suppliers, settings, notifications, analytics, email templates).
 * Plain module (no 'use client') so both server and client components can import it.
 */
import type { CSSProperties } from 'react';

export const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
export const SERIF = 'var(--font-newsreader), Georgia, serif';
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const INK = '#0F1623';
export const CREAM = '#F5F0E8';
export const DANGER = '#9A3B1E';
export const DANGER_BG = '#F5E1DA';
export const OK = '#1E6B45';
export const OK_BG = '#E0F2E9';
export const AMBER = '#8A6100';
export const AMBER_BG = '#FFF8E6';
export const AMBER_BORDER = '#E8C468';
export const TABLE_HEAD_BG = '#F9F6F0';
export const ROW_HOVER = '#FDFAF6';

/** Hover CSS inline styles cannot express. Render once per page in a <style> tag. */
export const ADMIN_FORM_CSS = `
.vl-row { transition: background-color 120ms ease; }
.vl-row:hover { background: ${ROW_HOVER}; }
.vl-navlink { transition: color 120ms ease, border-color 120ms ease; }
.vl-navlink:hover { color: var(--admin-text) !important; border-left-color: var(--admin-gold) !important; }
.vl-input:focus { border-color: ${INK} !important; outline: none; }
`;

/** White, square-edged section card. */
export const sectionCard: CSSProperties = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: 0,
  padding: '24px',
};

/** Serif section title with a hairline underneath. */
export const sectionTitle: CSSProperties = {
  fontFamily: SERIF,
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--admin-text)',
  margin: '0 0 20px',
  paddingBottom: '12px',
  borderBottom: '1px solid var(--admin-border-light)',
};

/** Small uppercase label for sub-groups inside a card. */
export const subLabel: CSSProperties = {
  fontFamily: SANS,
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--admin-text-muted)',
  margin: '0 0 10px',
};

export const fieldLabel: CSSProperties = {
  display: 'block',
  fontFamily: SANS,
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--admin-text-muted)',
  margin: '0 0 6px',
};

export const hint: CSSProperties = {
  fontFamily: SANS,
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'var(--admin-text-subtle)',
  margin: '6px 0 0',
};

export function input(invalid = false): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    fontSize: '14px',
    fontFamily: SANS,
    color: 'var(--admin-text)',
    background: '#FFFFFF',
    border: `1px solid ${invalid ? DANGER : 'var(--admin-border)'}`,
    borderRadius: 0,
    minWidth: 0,
  };
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

export function button(kind: ButtonKind, disabled = false, size: 'sm' | 'md' = 'md'): CSSProperties {
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
    padding: size === 'sm' ? '6px 12px' : '9px 18px',
    borderRadius: 0,
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
    case 'dangerSoft':
      return { ...base, background: 'transparent', color: DANGER, border: '1px solid transparent', padding: size === 'sm' ? '6px 4px' : '9px 6px' };
    case 'ghost':
    default:
      return { ...base, background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' };
  }
}

/** Status / flash line under a form. */
export function flash(kind: 'ok' | 'error' | 'muted'): CSSProperties {
  return {
    fontFamily: SANS,
    fontSize: '13px',
    margin: '12px 0 0',
    color: kind === 'ok' ? OK : kind === 'error' ? DANGER : 'var(--admin-text-muted)',
  };
}

/** Bordered info box (current value read-outs). */
export const infoBox: CSSProperties = {
  padding: '12px 14px',
  border: '1px solid var(--admin-border-light)',
  background: TABLE_HEAD_BG,
  fontFamily: SANS,
  fontSize: '13px',
  lineHeight: 1.6,
  color: 'var(--admin-text)',
};

/** Thin amber-bordered warning box (TPIN gates, threshold warnings). */
export const warnBox: CSSProperties = {
  padding: '10px 14px',
  border: `1px solid ${AMBER_BORDER}`,
  borderLeft: `3px solid ${AMBER_BORDER}`,
  background: AMBER_BG,
  fontFamily: SANS,
  fontSize: '13px',
  lineHeight: 1.5,
  color: '#7A5200',
};

export const th: CSSProperties = {
  background: TABLE_HEAD_BG,
  textAlign: 'left',
  fontFamily: SANS,
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
  padding: '8px 12px',
  borderBottom: '1px solid var(--admin-border-light)',
  fontFamily: SANS,
  fontSize: '13px',
  color: 'var(--admin-text)',
  verticalAlign: 'middle',
};

/** Square on/off switch track + knob. */
export function switchTrack(on: boolean, disabled: boolean): CSSProperties {
  return {
    flexShrink: 0,
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: 0,
    border: `1px solid ${on ? INK : 'var(--admin-border)'}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: on ? INK : '#E9E3D8',
    transition: 'background 0.2s',
    padding: 0,
  };
}

export function switchKnob(on: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: '2px',
    left: on ? '22px' : '2px',
    width: '18px',
    height: '18px',
    borderRadius: 0,
    background: on ? CREAM : '#FFFFFF',
    transition: 'left 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  };
}
