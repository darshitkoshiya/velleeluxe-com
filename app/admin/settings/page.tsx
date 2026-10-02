'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BrandPromiseIcon as BrandPromiseIconSvg } from '@/components/home/BrandPromiseIcon';
import PageHeader from '@/components/admin/ui/PageHeader';
import {
  ADMIN_FORM_CSS,
  AMBER,
  DANGER,
  MONO,
  OK,
  SANS,
  SERIF,
  button,
  fieldLabel,
  flash,
  hint,
  infoBox,
  input,
  sectionCard,
  sectionTitle,
  subLabel,
  switchKnob,
  switchTrack,
  warnBox,
} from '@/components/admin/ui/form-styles';

/** Left-nav groups. Each one is an anchor on this single page (no router state). */
const SETTINGS_GROUPS: { id: string; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'pricing', label: 'Pricing & Sync' },
  { id: 'payments', label: 'Payments' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns' },
  { id: 'security', label: 'Security' },
];

/** One settings group: white square card with a serif title, addressable by #id. */
function SettingsGroup({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} style={{ ...sectionCard, scrollMarginTop: 'calc(var(--admin-header-height) + 24px)' }}>
      <h2 id={`${id}-title`} style={{ ...sectionTitle, marginBottom: description ? '0' : sectionTitle.margin }}>
        {title}
      </h2>
      {description ? (
        <p style={{ ...hint, margin: '10px 0 16px', fontSize: '13px', color: 'var(--admin-text-muted)' }}>{description}</p>
      ) : null}
      {children}
    </section>
  );
}

/** A sub-heading block inside a group, separated from the previous block by a hairline. */
function SubBlock({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <div style={first ? undefined : { marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--admin-border-light)' }}>
      <h3 style={subLabel}>{title}</h3>
      {children}
    </div>
  );
}

/** Label (140px, muted) | control (flex) row. */
function SettingRow({
  label,
  htmlFor,
  labelId,
  description,
  descriptionId,
  children,
  first = false,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  description?: ReactNode;
  descriptionId?: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '12px 0',
        borderTop: first ? 'none' : '1px solid var(--admin-border-light)',
      }}
    >
      <div style={{ width: '140px', flexShrink: 0, paddingTop: '8px' }}>
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--admin-text-muted)' }}>
            {label}
          </label>
        ) : (
          <span id={labelId} style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--admin-text-muted)' }}>
            {label}
          </span>
        )}
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        {children}
        {description ? (
          <p id={descriptionId} style={hint}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Amber-bordered notice shown above every TPIN-gated form. */
function TpinNotice() {
  return (
    <div role="note" style={{ ...warnBox, marginBottom: '4px' }}>
      <strong style={{ fontWeight: 600 }}>TPIN required.</strong> This change is checked against your admin transaction PIN on
      the server. A wrong TPIN clears the field.
    </div>
  );
}

/** Must match MAX_FREE_SHIPPING_THRESHOLD in lib/settings.ts (the API enforces it). */
const MAX_FREE_SHIPPING_THRESHOLD = 100000;
/** Must match MAX_SHIPPING_FEE in lib/settings.ts (the API enforces it). */
const MAX_SHIPPING_FEE = 2000;
/** Must match MAX_RETURN_WINDOW_DAYS in lib/settings.ts (the API enforces it). */
const MAX_RETURN_WINDOW_DAYS = 90;

type SettingsResponse = {
  codEnabled?: boolean;
  freeShippingThreshold?: number;
  shippingFee?: number;
  returnWindowByCategory?: Record<string, number>;
  socialLinks?: Partial<SocialLinks>;
  stockNotFoundBehaviour?: StockNotFoundBehaviour;
  brandPromise?: unknown;
  error?: string;
};

/** Mirrors BrandPromiseIcon / BrandPromiseItem in lib/settings.ts (that file is server-only). */
type BrandPromiseIcon = 'truck' | 'return' | 'chat' | 'shield' | 'star' | 'heart' | 'clock' | 'check' | 'gift' | 'lock' | 'tag' | 'bolt';
interface BrandPromiseItem {
  icon: BrandPromiseIcon;
  title: string;
  description: string;
}
const BRAND_PROMISE_ICONS: BrandPromiseIcon[] = ['truck', 'return', 'chat', 'shield', 'star', 'heart', 'clock', 'check', 'gift', 'lock', 'tag', 'bolt'];
/** Must match the limits in lib/settings.ts (the API enforces them). */
const MAX_BRAND_PROMISE_TITLE = 60;
const MAX_BRAND_PROMISE_DESC = 200;
const MAX_BRAND_PROMISE_ITEMS = 6;
const MIN_BRAND_PROMISE_ITEMS = 1;

const BRAND_PROMISE_ICON_LABELS: Record<BrandPromiseIcon, string> = {
  truck: 'Truck',
  return: 'Return',
  chat: 'Chat',
  shield: 'Shield',
  star: 'Star',
  heart: 'Heart',
  clock: 'Clock',
  check: 'Check',
  gift: 'Gift',
  lock: 'Lock',
  tag: 'Tag',
  bolt: 'Bolt',
};

/** Mirrors DEFAULT_BRAND_PROMISE in lib/settings.ts. */
const DEFAULT_BRAND_PROMISE: BrandPromiseItem[] = [
  { icon: 'truck', title: 'Free Shipping', description: 'On all orders over ₹999, delivered across India.' },
  { icon: 'return', title: '7-Day Returns', description: 'Not the right fit? Return or exchange within seven days.' },
  { icon: 'chat', title: 'WhatsApp Support', description: 'Real people, quick answers on sizing, orders and more.' },
];

/** One editable brand promise item; `id` is only a stable React key (never saved). */
type BrandPromiseRow = BrandPromiseItem & { id: number };

let nextPromiseId = 1;

/** Turns the API value into editable rows, falling back to the defaults if it is malformed. */
function toBrandPromiseRows(value: unknown): BrandPromiseRow[] {
  const items =
    Array.isArray(value) &&
    value.length >= MIN_BRAND_PROMISE_ITEMS &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        BRAND_PROMISE_ICONS.includes((item as BrandPromiseItem).icon) &&
        typeof (item as BrandPromiseItem).title === 'string' &&
        typeof (item as BrandPromiseItem).description === 'string',
    )
      ? (value as BrandPromiseItem[])
      : DEFAULT_BRAND_PROMISE;
  return items.map((item) => ({ id: nextPromiseId++, icon: item.icon, title: item.title, description: item.description }));
}

/** The saveable items (without React ids). */
function toBrandPromiseItems(rows: BrandPromiseRow[]): BrandPromiseItem[] {
  return rows.map(({ icon, title, description }) => ({ icon, title: title.trim(), description: description.trim() }));
}

function brandPromiseSnapshot(rows: BrandPromiseRow[]): string {
  return JSON.stringify(toBrandPromiseItems(rows));
}

/** Returns an error message if the brand promise items cannot be saved. */
function brandPromiseError(rows: BrandPromiseRow[]): string | null {
  if (rows.length < MIN_BRAND_PROMISE_ITEMS || rows.length > MAX_BRAND_PROMISE_ITEMS) {
    return `Brand promise needs ${MIN_BRAND_PROMISE_ITEMS} to ${MAX_BRAND_PROMISE_ITEMS} items.`;
  }
  for (const [index, row] of rows.entries()) {
    if (!row.title.trim()) return `Brand promise item ${index + 1} needs a title.`;
    if (row.title.trim().length > MAX_BRAND_PROMISE_TITLE) {
      return `Brand promise item ${index + 1}: keep the title under ${MAX_BRAND_PROMISE_TITLE} characters.`;
    }
    if (row.description.trim().length > MAX_BRAND_PROMISE_DESC) {
      return `Brand promise item ${index + 1}: keep the description under ${MAX_BRAND_PROMISE_DESC} characters.`;
    }
  }
  return null;
}

/** Mirrors StockNotFoundBehaviour in lib/settings.ts. */
type StockNotFoundBehaviour = 'sold_out' | 'unlimited';

function toStockBehaviour(value: unknown): StockNotFoundBehaviour {
  return value === 'unlimited' ? 'unlimited' : 'sold_out';
}

const STOCK_OPTIONS: { value: StockNotFoundBehaviour; label: string; description: string }[] = [
  {
    value: 'sold_out',
    label: 'Sold Out (stock = 0)',
    description: 'Safe default. The product shows as sold out until its stock is confirmed in a sheet.',
  },
  {
    value: 'unlimited',
    label: 'Unlimited — show as available',
    description: 'The product can be bought even though no stock number was found for it.',
  },
];

/** Mirrors SocialLinks in lib/settings.ts (that file is server-only). */
type SocialLinks = {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  pinterest: string;
};

const EMPTY_SOCIAL_LINKS: SocialLinks = { instagram: '', facebook: '', twitter: '', youtube: '', pinterest: '' };

/** Must match MAX_SOCIAL_LINK_LENGTH in lib/settings.ts (the API enforces it). */
const MAX_SOCIAL_LINK_LENGTH = 300;

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/velleeluxe' },
  { key: 'facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/velleeluxe' },
  { key: 'twitter', label: 'X / Twitter URL', placeholder: 'https://x.com/velleeluxe' },
  { key: 'youtube', label: 'YouTube URL', placeholder: 'https://youtube.com/@velleeluxe' },
  { key: 'pinterest', label: 'Pinterest URL', placeholder: 'https://pinterest.com/velleeluxe' },
];

function toSocialLinks(value: Partial<SocialLinks> | undefined): SocialLinks {
  const result = { ...EMPTY_SOCIAL_LINKS };
  for (const { key } of SOCIAL_FIELDS) {
    const link = value?.[key];
    if (typeof link === 'string') result[key] = link;
  }
  return result;
}

function socialSnapshot(links: SocialLinks): string {
  return JSON.stringify(SOCIAL_FIELDS.map(({ key }) => links[key].trim()));
}

/** Returns an error message if a social link is not empty and not a valid http(s) URL. */
function socialLinkError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_SOCIAL_LINK_LENGTH) return `Keep links under ${MAX_SOCIAL_LINK_LENGTH} characters.`;
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return 'Enter the full link, starting with https://';
  return null;
}

/** One editable category row in the Return Windows section. */
type CategoryRow = { id: number; name: string; days: string };

let nextRowId = 1;

/** Turns a saved map into the Default days box + category rows. */
function windowsToState(map: Record<string, number>): { defaultDays: string; rows: CategoryRow[] } {
  const rows = Object.entries(map)
    .filter(([key]) => key !== 'default')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, days]) => ({ id: nextRowId++, name, days: String(days) }));
  return { defaultDays: String(map.default ?? 7), rows };
}

/** Returns whole days 1..MAX_RETURN_WINDOW_DAYS typed in a box, or null if not valid. */
function parseDays(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= 1 && days <= MAX_RETURN_WINDOW_DAYS ? days : null;
}

/** Builds the returnWindowByCategory map, or an error message if any row is invalid. */
function serialiseWindows(defaultDays: string, rows: CategoryRow[]): { map: Record<string, number> } | { error: string } {
  const daysError = `Return window days must be a whole number from 1 to ${MAX_RETURN_WINDOW_DAYS}.`;
  const def = parseDays(defaultDays);
  if (def === null) return { error: daysError };
  const map: Record<string, number> = { default: def };
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) return { error: 'Every return window row needs a category name.' };
    if (name.toLowerCase() === 'default') return { error: '"Default" is reserved — pick another category name.' };
    if (Object.keys(map).some((key) => key.toLowerCase() === name.toLowerCase())) {
      return { error: `The category "${name}" is listed more than once.` };
    }
    const days = parseDays(row.days);
    if (days === null) return { error: daysError };
    map[name] = days;
  }
  return { map };
}

/** Comparable snapshot of what the Return Windows section shows. */
function windowsSnapshot(defaultDays: string, rows: CategoryRow[]): string {
  return JSON.stringify([defaultDays.trim(), rows.map((row) => [row.name.trim(), row.days.trim()])]);
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Returns the whole-rupee threshold typed in the box, or null if it is not valid. */
function parseThreshold(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= MAX_FREE_SHIPPING_THRESHOLD ? amount : null;
}

/** Returns the whole-rupee shipping fee typed in the box, or null if it is not valid. */
function parseShippingFee(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= MAX_SHIPPING_FEE ? amount : null;
}

export default function AdminSettingsPage() {
  /** What is saved in the database right now. */
  const [savedCod, setSavedCod] = useState<boolean | null>(null);
  /** What the switch currently shows (may be unsaved). */
  const [codEnabled, setCodEnabled] = useState(true);
  /** Free-shipping threshold saved in the database right now. */
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  /** What the threshold box currently shows (may be unsaved or not yet valid). */
  const [thresholdInput, setThresholdInput] = useState('');
  /** Flat shipping fee saved in the database right now. */
  const [savedShippingFee, setSavedShippingFee] = useState<number | null>(null);
  /** What the shipping fee box currently shows (may be unsaved or not yet valid). */
  const [shippingFeeInput, setShippingFeeInput] = useState('');
  /** Snapshot of the saved return windows (null until loaded). */
  const [savedWindowsSnapshot, setSavedWindowsSnapshot] = useState<string | null>(null);
  /** Default return window days box (may be unsaved). */
  const [defaultDays, setDefaultDays] = useState('');
  /** Per-category return window rows (may be unsaved). */
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  /** Snapshot of the saved social links (null until loaded). */
  const [savedSocialSnapshot, setSavedSocialSnapshot] = useState<string | null>(null);
  /** Social link boxes (may be unsaved). */
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(EMPTY_SOCIAL_LINKS);
  /** Saved stock-not-found behaviour (null until loaded). */
  const [savedStockBehaviour, setSavedStockBehaviour] = useState<StockNotFoundBehaviour | null>(null);
  /** Selected stock-not-found behaviour (may be unsaved). */
  const [stockBehaviour, setStockBehaviour] = useState<StockNotFoundBehaviour>('sold_out');
  /** Snapshot of the saved brand promise items (null until loaded). */
  const [savedBrandPromiseSnapshot, setSavedBrandPromiseSnapshot] = useState<string | null>(null);
  /** Brand promise items being edited (may be unsaved). */
  const [brandPromise, setBrandPromise] = useState<BrandPromiseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /**
   * Shown after a save that changed the free-shipping threshold while a brand promise
   * description still mentions a rupee amount. Only rendered alongside `message`, so it
   * disappears as soon as the admin makes any new change (every edit clears `message`).
   */
  const [thresholdWarning, setThresholdWarning] = useState<string | null>(null);

  const applySavedWindows = (map: Record<string, number>) => {
    const state = windowsToState(map);
    setDefaultDays(state.defaultDays);
    setCategoryRows(state.rows);
    setSavedWindowsSnapshot(windowsSnapshot(state.defaultDays, state.rows));
  };

  const applySavedSocial = (value: Partial<SocialLinks> | undefined) => {
    const links = toSocialLinks(value);
    setSocialLinks(links);
    setSavedSocialSnapshot(socialSnapshot(links));
  };

  const applySavedBrandPromise = (value: unknown) => {
    const rows = toBrandPromiseRows(value);
    setBrandPromise(rows);
    setSavedBrandPromiseSnapshot(brandPromiseSnapshot(rows));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as SettingsResponse;
        if (
          !response.ok ||
          typeof data.codEnabled !== 'boolean' ||
          typeof data.freeShippingThreshold !== 'number' ||
          typeof data.shippingFee !== 'number' ||
          typeof data.returnWindowByCategory !== 'object' ||
          data.returnWindowByCategory === null
        ) {
          throw new Error(data.error || 'Could not load settings.');
        }
        if (!cancelled) {
          setSavedCod(data.codEnabled);
          setCodEnabled(data.codEnabled);
          setSavedThreshold(data.freeShippingThreshold);
          setThresholdInput(String(data.freeShippingThreshold));
          setSavedShippingFee(data.shippingFee);
          setShippingFeeInput(String(data.shippingFee));
          applySavedWindows(data.returnWindowByCategory);
          applySavedSocial(data.socialLinks);
          setSavedStockBehaviour(toStockBehaviour(data.stockNotFoundBehaviour));
          setStockBehaviour(toStockBehaviour(data.stockNotFoundBehaviour));
          applySavedBrandPromise(data.brandPromise);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const threshold = parseThreshold(thresholdInput);
  const thresholdInvalid = savedThreshold !== null && threshold === null;
  const shippingFee = parseShippingFee(shippingFeeInput);
  const shippingFeeInvalid = savedShippingFee !== null && shippingFee === null;

  const save = async () => {
    if (threshold === null) {
      setError(`Free shipping threshold must be a whole number between 0 and ${formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.`);
      return;
    }
    if (shippingFee === null) {
      setError(`Flat shipping fee must be a whole number between 0 and ${formatRupees(MAX_SHIPPING_FEE)}.`);
      return;
    }
    const windows = serialiseWindows(defaultDays, categoryRows);
    if ('error' in windows) {
      setError(windows.error);
      return;
    }
    const badSocial = SOCIAL_FIELDS.find(({ key }) => socialLinkError(socialLinks[key]) !== null);
    if (badSocial) {
      setError(`${badSocial.label}: ${socialLinkError(socialLinks[badSocial.key])}`);
      return;
    }
    const promiseError = brandPromiseError(brandPromise);
    if (promiseError) {
      setError(promiseError);
      return;
    }
    const trimmedSocial = toSocialLinks(
      Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, socialLinks[key].trim()])) as Partial<SocialLinks>,
    );
    const previousThreshold = savedThreshold;
    setSaving(true);
    setError(null);
    setMessage(null);
    setThresholdWarning(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codEnabled,
          freeShippingThreshold: threshold,
          shippingFee,
          returnWindowByCategory: windows.map,
          socialLinks: trimmedSocial,
          stockNotFoundBehaviour: stockBehaviour,
          brandPromise: toBrandPromiseItems(brandPromise),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as SettingsResponse;
      if (
        !response.ok ||
        typeof data.codEnabled !== 'boolean' ||
        typeof data.freeShippingThreshold !== 'number' ||
        typeof data.shippingFee !== 'number' ||
        typeof data.returnWindowByCategory !== 'object' ||
        data.returnWindowByCategory === null
      ) {
        throw new Error(data.error || 'Could not save settings.');
      }
      setSavedCod(data.codEnabled);
      setCodEnabled(data.codEnabled);
      setSavedThreshold(data.freeShippingThreshold);
      setThresholdInput(String(data.freeShippingThreshold));
      setSavedShippingFee(data.shippingFee);
      setShippingFeeInput(String(data.shippingFee));
      applySavedWindows(data.returnWindowByCategory);
      applySavedSocial(data.socialLinks);
      setSavedStockBehaviour(toStockBehaviour(data.stockNotFoundBehaviour));
      setStockBehaviour(toStockBehaviour(data.stockNotFoundBehaviour));
      applySavedBrandPromise(data.brandPromise);
      const thresholdChanged = previousThreshold !== null && previousThreshold !== data.freeShippingThreshold;
      const promiseMentionsRupees = toBrandPromiseRows(data.brandPromise).some((item) => /₹[\d,]+/.test(item.description));
      if (thresholdChanged && promiseMentionsRupees && previousThreshold !== null) {
        setThresholdWarning(
          `Free shipping threshold updated. Remember to also update the Brand Promise text if it mentions the old amount (${formatRupees(previousThreshold)}).`,
        );
      }
      setMessage(
        `Saved. Cash on Delivery is now ${data.codEnabled ? 'ON' : 'OFF'}, shipping is free on orders of ${formatRupees(data.freeShippingThreshold)} or more, the default return window is ${data.returnWindowByCategory.default} days, and the flat shipping fee is ${formatRupees(data.shippingFee)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const unsaved =
    (savedCod !== null && savedCod !== codEnabled) ||
    (savedThreshold !== null && thresholdInput.trim() !== String(savedThreshold)) ||
    (savedShippingFee !== null && shippingFeeInput.trim() !== String(savedShippingFee)) ||
    (savedWindowsSnapshot !== null && savedWindowsSnapshot !== windowsSnapshot(defaultDays, categoryRows)) ||
    (savedSocialSnapshot !== null && savedSocialSnapshot !== socialSnapshot(socialLinks)) ||
    (savedStockBehaviour !== null && savedStockBehaviour !== stockBehaviour) ||
    (savedBrandPromiseSnapshot !== null && savedBrandPromiseSnapshot !== brandPromiseSnapshot(brandPromise));
  const notLoaded =
    savedCod === null ||
    savedThreshold === null ||
    savedShippingFee === null ||
    savedWindowsSnapshot === null ||
    savedSocialSnapshot === null ||
    savedStockBehaviour === null ||
    savedBrandPromiseSnapshot === null;
  const stockDisabled = savedStockBehaviour === null || saving;
  const promiseDisabled = savedBrandPromiseSnapshot === null || saving;

  const updatePromise = (id: number, patch: Partial<BrandPromiseItem>) => {
    setBrandPromise((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setMessage(null);
  };

  const movePromise = (index: number, direction: -1 | 1) => {
    setBrandPromise((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setMessage(null);
  };
  const socialDisabled = savedSocialSnapshot === null || saving;
  const saveDisabled = saving || notLoaded || !unsaved || thresholdInvalid || shippingFeeInvalid;

  const windowsDisabled = savedWindowsSnapshot === null || saving;
  const defaultDaysInvalid = savedWindowsSnapshot !== null && parseDays(defaultDays) === null;

  const updateRow = (id: number, patch: Partial<Omit<CategoryRow, 'id'>>) => {
    setCategoryRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setMessage(null);
  };

  const codDisabled = savedCod === null || saving;

  return (
    <div style={{ maxWidth: '1080px', fontFamily: SANS, color: 'var(--admin-text)' }}>
      <style>{ADMIN_FORM_CSS}</style>
      <PageHeader title="Settings" subtitle="Store configuration, payments, shipping and integrations" />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>
        {/* Left anchor nav */}
        <nav
          aria-label="Settings sections"
          style={{
            width: '160px',
            flexShrink: 0,
            position: 'sticky',
            top: 'calc(var(--admin-header-height) + 24px)',
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {SETTINGS_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="vl-navlink"
                  style={{
                    display: 'block',
                    padding: '7px 12px',
                    fontFamily: SANS,
                    fontSize: '13px',
                    color: 'var(--admin-text-muted)',
                    textDecoration: 'none',
                    borderLeft: '2px solid var(--admin-border)',
                  }}
                >
                  {group.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content pane */}
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loading ? (
            <div style={sectionCard}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading settings…</p>
            </div>
          ) : (
            <>
              {/* 1. General */}
              <SettingsGroup id="general" title="General" description="Storefront content shown across the website.">
                <SubBlock title="Social Media" first>
                  <p style={{ ...hint, margin: '0 0 4px' }}>
                    Paste the full link to each profile. Icons appear in the website footer only for the links you fill in. Leave a
                    box empty to hide that icon.
                  </p>
                  {SOCIAL_FIELDS.map((field, index) => {
                    const id = `social-${field.key}`;
                    const fieldError = socialLinkError(socialLinks[field.key]);
                    return (
                      <SettingRow
                        key={field.key}
                        label={field.label.replace(/ URL$/, '')}
                        htmlFor={id}
                        first={index === 0}
                        description={fieldError ? <span style={{ color: DANGER }}>{fieldError}</span> : undefined}
                      >
                        <input
                          id={id}
                          className="vl-input"
                          type="url"
                          inputMode="url"
                          value={socialLinks[field.key]}
                          placeholder={field.placeholder}
                          maxLength={MAX_SOCIAL_LINK_LENGTH}
                          aria-invalid={fieldError !== null}
                          disabled={socialDisabled}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSocialLinks((links) => ({ ...links, [field.key]: value }));
                            setMessage(null);
                          }}
                          style={input(fieldError !== null)}
                        />
                      </SettingRow>
                    );
                  })}
                </SubBlock>

                <SubBlock title="Brand Promise">
                  <p style={{ ...hint, margin: '0 0 14px' }}>
                    The dark strip of promises on the homepage. Add {MIN_BRAND_PROMISE_ITEMS} to {MAX_BRAND_PROMISE_ITEMS} items, pick an
                    icon for each, and use the arrows to change the order.
                  </p>

                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {brandPromise.map((row, index) => {
                      const titleId = `promise-title-${row.id}`;
                      const descId = `promise-desc-${row.id}`;
                      const titleInvalid = row.title.trim() === '' || row.title.trim().length > MAX_BRAND_PROMISE_TITLE;
                      const descInvalid = row.description.trim().length > MAX_BRAND_PROMISE_DESC;
                      const upDisabled = promiseDisabled || index === 0;
                      const downDisabled = promiseDisabled || index === brandPromise.length - 1;
                      const removeDisabled = promiseDisabled || brandPromise.length <= MIN_BRAND_PROMISE_ITEMS;
                      return (
                        <li key={row.id} style={{ border: '1px solid var(--admin-border)', padding: '16px' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}
                          >
                            <span style={{ fontFamily: SERIF, fontSize: '14px', fontWeight: 600 }}>Item {index + 1}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                disabled={upDisabled}
                                onClick={() => movePromise(index, -1)}
                                aria-label={`Move item ${index + 1} up`}
                                style={button('ghost', upDisabled, 'sm')}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={downDisabled}
                                onClick={() => movePromise(index, 1)}
                                aria-label={`Move item ${index + 1} down`}
                                style={button('ghost', downDisabled, 'sm')}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                disabled={removeDisabled}
                                onClick={() => {
                                  setBrandPromise((rows) => rows.filter((r) => r.id !== row.id));
                                  setMessage(null);
                                }}
                                aria-label={`Remove item ${index + 1}`}
                                style={button('dangerSoft', removeDisabled, 'sm')}
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <fieldset style={{ border: 'none', margin: '0 0 12px', padding: 0 }}>
                            <legend style={{ ...fieldLabel, padding: 0 }}>Icon</legend>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '6px' }}>
                              {BRAND_PROMISE_ICONS.map((icon) => {
                                const selected = row.icon === icon;
                                return (
                                  <label
                                    key={icon}
                                    style={{
                                      position: 'relative',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '8px 4px',
                                      border: `1px solid ${selected ? '#0F1623' : 'var(--admin-border)'}`,
                                      boxShadow: selected ? 'inset 0 0 0 1px #0F1623' : 'none',
                                      background: selected ? '#F5F0E8' : '#FFFFFF',
                                      color: 'var(--admin-text)',
                                      cursor: promiseDisabled ? 'not-allowed' : 'pointer',
                                      opacity: promiseDisabled ? 0.6 : 1,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`promise-icon-${row.id}`}
                                      value={icon}
                                      checked={selected}
                                      disabled={promiseDisabled}
                                      onChange={() => updatePromise(row.id, { icon })}
                                      style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', margin: 0 }}
                                    />
                                    <BrandPromiseIconSvg icon={icon} size={20} />
                                    <span style={{ fontSize: '11px' }}>{BRAND_PROMISE_ICON_LABELS[icon]}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>

                          <label htmlFor={titleId} style={fieldLabel}>
                            Title
                          </label>
                          <input
                            id={titleId}
                            className="vl-input"
                            type="text"
                            value={row.title}
                            maxLength={MAX_BRAND_PROMISE_TITLE}
                            placeholder="e.g. Free Shipping"
                            aria-invalid={titleInvalid}
                            disabled={promiseDisabled}
                            onChange={(event) => updatePromise(row.id, { title: event.target.value })}
                            style={input(titleInvalid)}
                          />
                          <p style={{ ...hint, margin: '4px 0 12px', textAlign: 'right', color: titleInvalid ? DANGER : hint.color }}>
                            {row.title.trim() === '' ? 'A title is required. ' : ''}
                            {row.title.length}/{MAX_BRAND_PROMISE_TITLE}
                          </p>

                          <label htmlFor={descId} style={fieldLabel}>
                            Description
                          </label>
                          <textarea
                            id={descId}
                            className="vl-input"
                            value={row.description}
                            maxLength={MAX_BRAND_PROMISE_DESC}
                            rows={2}
                            placeholder="e.g. On all orders over ₹999, delivered across India."
                            aria-invalid={descInvalid}
                            disabled={promiseDisabled}
                            onChange={(event) => updatePromise(row.id, { description: event.target.value })}
                            style={{ ...input(descInvalid), resize: 'vertical', lineHeight: 1.5 }}
                          />
                          <p style={{ ...hint, margin: '4px 0 0', textAlign: 'right', color: descInvalid ? DANGER : hint.color }}>
                            {row.description.length}/{MAX_BRAND_PROMISE_DESC}
                          </p>
                        </li>
                      );
                    })}
                  </ol>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <button
                      type="button"
                      disabled={promiseDisabled || brandPromise.length >= MAX_BRAND_PROMISE_ITEMS}
                      onClick={() => {
                        setBrandPromise((rows) =>
                          rows.length >= MAX_BRAND_PROMISE_ITEMS
                            ? rows
                            : [...rows, { id: nextPromiseId++, icon: 'check', title: '', description: '' }],
                        );
                        setMessage(null);
                      }}
                      style={button('secondary', promiseDisabled || brandPromise.length >= MAX_BRAND_PROMISE_ITEMS, 'sm')}
                    >
                      + Add Item
                    </button>
                    <span style={{ ...hint, margin: 0 }}>
                      {brandPromise.length} of {MAX_BRAND_PROMISE_ITEMS} items. Text is shown exactly as written — if you change the free
                      shipping threshold, update it here too.
                    </span>
                  </div>
                </SubBlock>
              </SettingsGroup>

              {/* 2. Pricing & Sync */}
              <SettingsGroup id="pricing" title="Pricing & Sync" description="How supplier prices and stock flow into the store.">
                <AutoPriceSyncSection />

                <SubBlock title="Stock Defaults">
                  <fieldset style={{ border: 'none', margin: 0, padding: 0 }} aria-describedby="stock-default-description">
                    <legend style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, margin: '0 0 4px', padding: 0 }}>
                      When stock can&apos;t be found
                    </legend>
                    <p id="stock-default-description" style={{ ...hint, margin: '0 0 12px' }}>
                      Used for supplier products when their sheet has no stock column and the inventory sheet has no row for them.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {STOCK_OPTIONS.map((option) => {
                        const selected = stockBehaviour === option.value;
                        return (
                          <label
                            key={option.value}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '12px 14px',
                              border: `1px solid ${selected ? '#0F1623' : 'var(--admin-border)'}`,
                              background: selected ? '#FDFAF6' : '#FFFFFF',
                              cursor: stockDisabled ? 'not-allowed' : 'pointer',
                              opacity: stockDisabled ? 0.6 : 1,
                            }}
                          >
                            <input
                              type="radio"
                              name="stock-not-found-behaviour"
                              value={option.value}
                              checked={selected}
                              disabled={stockDisabled}
                              onChange={() => {
                                setStockBehaviour(option.value);
                                setMessage(null);
                              }}
                              style={{ marginTop: '3px', accentColor: '#0F1623' }}
                            />
                            <span>
                              <span style={{ display: 'block', fontSize: '14px', fontWeight: 500 }}>{option.label}</span>
                              <span style={{ display: 'block', ...hint, margin: '2px 0 0' }}>{option.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </SubBlock>

                <ImageStorageSection />
              </SettingsGroup>

              {/* 3. Payments */}
              <SettingsGroup id="payments" title="Payments" description="Checkout payment methods and Razorpay credentials.">
                <SubBlock title="Cash on Delivery" first>
                  <SettingRow
                    label="Cash on Delivery"
                    labelId="cod-label"
                    first
                    descriptionId="cod-description"
                    description="When enabled, customers can choose to pay cash when the order arrives."
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={codEnabled}
                        aria-labelledby="cod-label"
                        aria-describedby="cod-description"
                        disabled={codDisabled}
                        onClick={() => {
                          setCodEnabled((value) => !value);
                          setMessage(null);
                        }}
                        style={switchTrack(codEnabled, codDisabled)}
                      >
                        <span aria-hidden="true" style={switchKnob(codEnabled)} />
                      </button>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: codEnabled ? OK : 'var(--admin-text-muted)' }}>
                        {codEnabled ? 'ON' : 'OFF'}
                      </span>
                      {savedCod !== null ? (
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)' }}>
                          (saved: {savedCod ? 'ON' : 'OFF'})
                        </span>
                      ) : null}
                    </div>
                  </SettingRow>
                </SubBlock>

                <PaymentSettingsSection />
              </SettingsGroup>

              {/* 4. Shipping */}
              <SettingsGroup id="shipping" title="Shipping" description="Delivery fees, pickup location and courier integration.">
                <SubBlock title="Delivery Fees" first>
                  <SettingRow
                    label="Free shipping at (₹)"
                    htmlFor="free-shipping-threshold"
                    first
                    descriptionId="free-shipping-description"
                    description={
                      thresholdInvalid ? (
                        <span style={{ color: DANGER }}>Enter a whole number from 0 to {formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.</span>
                      ) : (
                        <>
                          Orders at or above this amount ship free; the cart progress bar and checkout both use it.
                          {savedThreshold !== null ? ` Currently ${formatRupees(savedThreshold)}.` : ''}
                        </>
                      )
                    }
                  >
                    <input
                      id="free-shipping-threshold"
                      className="vl-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_FREE_SHIPPING_THRESHOLD}
                      step={1}
                      value={thresholdInput}
                      aria-describedby="free-shipping-description"
                      aria-invalid={thresholdInvalid}
                      disabled={savedThreshold === null || saving}
                      onChange={(event) => {
                        setThresholdInput(event.target.value);
                        setMessage(null);
                      }}
                      style={{ ...input(thresholdInvalid), maxWidth: '180px' }}
                    />
                  </SettingRow>

                  <SettingRow
                    label="Flat fee (₹)"
                    htmlFor="flat-shipping-fee"
                    descriptionId="flat-shipping-fee-description"
                    description={
                      shippingFeeInvalid ? (
                        <span style={{ color: DANGER }}>Enter a whole number from 0 to {formatRupees(MAX_SHIPPING_FEE)}.</span>
                      ) : (
                        <>
                          Charged when the order total is below the free shipping threshold.
                          {savedShippingFee !== null ? ` Currently ${formatRupees(savedShippingFee)} per order.` : ''}
                        </>
                      )
                    }
                  >
                    <input
                      id="flat-shipping-fee"
                      className="vl-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_SHIPPING_FEE}
                      step={1}
                      value={shippingFeeInput}
                      aria-describedby="flat-shipping-fee-description"
                      aria-invalid={shippingFeeInvalid}
                      disabled={savedShippingFee === null || saving}
                      onChange={(event) => {
                        setShippingFeeInput(event.target.value);
                        setMessage(null);
                      }}
                      style={{ ...input(shippingFeeInvalid), maxWidth: '180px' }}
                    />
                  </SettingRow>
                </SubBlock>

                <PickupPincodeSection />

                <EkartSection />
              </SettingsGroup>

              {/* 5. Returns */}
              <SettingsGroup id="returns" title="Returns" description="How many days customers have to return or exchange an item, by product category.">
                <div style={{ border: '1px solid var(--admin-border)' }}>
                  <div
                    aria-hidden="true"
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '10px 12px',
                      background: '#F9F6F0',
                      borderBottom: '1px solid var(--admin-border)',
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--admin-text-muted)',
                    }}
                  >
                    <span style={{ flex: 1 }}>Category</span>
                    <span style={{ width: '90px' }}>Days</span>
                    <span style={{ width: '76px' }} />
                  </div>

                  <ul id="return-windows-description" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    <li
                      className="vl-row"
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '6px 12px', borderBottom: '1px solid var(--admin-border-light)' }}
                    >
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--admin-text)' }}>
                        Default <span style={{ color: 'var(--admin-text-subtle)' }}>(all products)</span>
                      </span>
                      <input
                        type="number"
                        className="vl-input"
                        inputMode="numeric"
                        min={1}
                        max={MAX_RETURN_WINDOW_DAYS}
                        step={1}
                        value={defaultDays}
                        aria-label="Default return window in days"
                        aria-invalid={defaultDaysInvalid}
                        disabled={windowsDisabled}
                        onChange={(event) => {
                          setDefaultDays(event.target.value);
                          setMessage(null);
                        }}
                        style={{ ...input(defaultDaysInvalid), width: '90px', flexShrink: 0 }}
                      />
                      <span style={{ width: '76px', flexShrink: 0 }} />
                    </li>

                    {categoryRows.map((row) => {
                      const nameInvalid = row.name.trim() === '' || row.name.trim().toLowerCase() === 'default';
                      const daysInvalid = parseDays(row.days) === null;
                      return (
                        <li
                          key={row.id}
                          className="vl-row"
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '6px 12px', borderBottom: '1px solid var(--admin-border-light)' }}
                        >
                          <input
                            type="text"
                            className="vl-input"
                            value={row.name}
                            placeholder="e.g. Shirts"
                            aria-label="Category name"
                            aria-invalid={nameInvalid}
                            disabled={windowsDisabled}
                            onChange={(event) => updateRow(row.id, { name: event.target.value })}
                            style={{ ...input(nameInvalid), flex: 1 }}
                          />
                          <input
                            type="number"
                            className="vl-input"
                            inputMode="numeric"
                            min={1}
                            max={MAX_RETURN_WINDOW_DAYS}
                            step={1}
                            value={row.days}
                            aria-label={`Return window in days for ${row.name.trim() || 'this category'}`}
                            aria-invalid={daysInvalid}
                            disabled={windowsDisabled}
                            onChange={(event) => updateRow(row.id, { days: event.target.value })}
                            style={{ ...input(daysInvalid), width: '90px', flexShrink: 0 }}
                          />
                          <button
                            type="button"
                            disabled={windowsDisabled}
                            onClick={() => {
                              setCategoryRows((rows) => rows.filter((r) => r.id !== row.id));
                              setMessage(null);
                            }}
                            aria-label={`Remove ${row.name.trim() || 'this category'}`}
                            style={{ ...button('dangerSoft', windowsDisabled, 'sm'), width: '76px' }}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button
                    type="button"
                    disabled={windowsDisabled}
                    onClick={() => {
                      setCategoryRows((rows) => [...rows, { id: nextRowId++, name: '', days: defaultDays.trim() || '7' }]);
                      setMessage(null);
                    }}
                    style={button('secondary', windowsDisabled, 'sm')}
                  >
                    + Add Category
                  </button>
                  <span style={{ ...hint, margin: 0 }}>Days must be a whole number from 1 to {MAX_RETURN_WINDOW_DAYS}.</span>
                </div>
              </SettingsGroup>

              {/* 6. Security */}
              <SettingsGroup id="security" title="Security" description="Sensitive changes are protected by your admin transaction PIN (TPIN).">
                <div role="note" style={warnBox}>
                  <strong style={{ fontWeight: 600 }}>TPIN-protected actions.</strong> The TPIN is checked on the server for every
                  sensitive save and is never stored in this page. If a save is rejected, the TPIN field is cleared and you can try
                  again.
                </div>
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
                  {[
                    { href: '#payments', label: 'Razorpay API keys', group: 'Payments' },
                    { href: '#shipping', label: 'Warehouse pickup pincode', group: 'Shipping' },
                    { href: '#shipping', label: 'Ekart courier credentials', group: 'Shipping' },
                  ].map((item, index) => (
                    <li
                      key={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        minHeight: '44px',
                        borderTop: index === 0 ? 'none' : '1px solid var(--admin-border-light)',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{item.label}</span>
                      <a href={item.href} style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                        {item.group} →
                      </a>
                    </li>
                  ))}
                </ul>
              </SettingsGroup>
            </>
          )}

          {/* Sticky save bar for the settings saved together (everything except TPIN-gated items and sync interval). */}
          <div
            style={{
              ...sectionCard,
              position: 'sticky',
              bottom: 0,
              zIndex: 5,
              padding: '14px 20px',
              boxShadow: unsaved ? '0 -6px 16px rgba(15, 22, 35, 0.06)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void save()} disabled={saveDisabled} style={button('primary', saveDisabled)}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {unsaved ? (
                <span style={{ fontSize: '13px', color: AMBER }}>You have unsaved changes.</span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--admin-text-subtle)' }}>
                  Saves General, Stock Defaults, COD, Delivery Fees and Returns. Keys, pincode, Ekart and sync interval save on their own.
                </span>
              )}
            </div>
            {message ? (
              <p role="status" style={flash('ok')}>
                {message}
              </p>
            ) : null}
            {message && thresholdWarning ? (
              <p role="alert" style={{ ...warnBox, margin: '10px 0 0' }}>
                {thresholdWarning}
              </p>
            ) : null}
            {error ? (
              <p role="alert" style={flash('error')}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


/** Must match MAX_PRICE_SYNC_INTERVAL_HOURS in lib/settings.ts (the API enforces it). */
const MAX_PRICE_SYNC_INTERVAL_HOURS = 168;

type PriceSyncResponse = { priceSyncIntervalHours?: number; lastPriceSyncAt?: string; error?: string };

/** "Never", "just now", "5 minutes ago", "2 hours ago", "3 days ago" — plus the full date/time. */
function formatLastSync(iso: string): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  const full = date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  let relative: string;
  if (minutes < 1) relative = 'just now';
  else if (minutes < 60) relative = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  else if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60);
    relative = `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else {
    const days = Math.floor(minutes / (60 * 24));
    relative = `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return `${relative} (${full})`;
}

/**
 * Auto price sync interval (Vercel Cron checks hourly). Saved on its own when the box
 * loses focus or Enter is pressed — not by the main Save button.
 */
function AutoPriceSyncSection() {
  const [savedInterval, setSavedInterval] = useState<number | null>(null);
  const [intervalInput, setIntervalInput] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as PriceSyncResponse;
        if (!response.ok || typeof data.priceSyncIntervalHours !== 'number') {
          throw new Error(data.error || 'Could not load price sync settings.');
        }
        if (!cancelled) {
          setSavedInterval(data.priceSyncIntervalHours);
          setIntervalInput(String(data.priceSyncIntervalHours));
          setLastSyncAt(typeof data.lastPriceSyncAt === 'string' ? data.lastPriceSyncAt : '');
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load price sync settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  const trimmed = intervalInput.trim();
  const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  const intervalInvalid = savedInterval !== null && (parsed === null || parsed > MAX_PRICE_SYNC_INTERVAL_HOURS);

  const saveInterval = async () => {
    if (savedInterval === null || saving) return;
    if (parsed === null || parsed > MAX_PRICE_SYNC_INTERVAL_HOURS) {
      setError(`Enter a whole number of hours from 0 to ${MAX_PRICE_SYNC_INTERVAL_HOURS}.`);
      return;
    }
    if (parsed === savedInterval) {
      setIntervalInput(String(savedInterval));
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceSyncIntervalHours: parsed }),
      });
      const data = (await response.json().catch(() => ({}))) as PriceSyncResponse;
      if (!response.ok || typeof data.priceSyncIntervalHours !== 'number') {
        throw new Error(data.error || 'Could not save price sync interval.');
      }
      setSavedInterval(data.priceSyncIntervalHours);
      setIntervalInput(String(data.priceSyncIntervalHours));
      if (typeof data.lastPriceSyncAt === 'string') setLastSyncAt(data.lastPriceSyncAt);
      setSavedFlash(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save price sync interval.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubBlock title="Auto Price Sync" first>
      {loadError ? (
        <p role="alert" style={{ ...flash('error'), margin: 0 }}>
          {loadError}
        </p>
      ) : (
        <>
          <SettingRow
            label="Sync interval"
            htmlFor="price-sync-interval"
            first
            descriptionId="price-sync-interval-description"
            description={`Hours between automatic syncs. Set to 0 to disable. Max ${MAX_PRICE_SYNC_INTERVAL_HOURS} hours (1 week). Saves when you press Enter or click Save.`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                id="price-sync-interval"
                className="vl-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PRICE_SYNC_INTERVAL_HOURS}
                step={1}
                placeholder="6"
                value={intervalInput}
                aria-describedby="price-sync-interval-description"
                aria-invalid={intervalInvalid}
                disabled={savedInterval === null || saving}
                onChange={(event) => {
                  setIntervalInput(event.target.value);
                  setError(null);
                  setSavedFlash(false);
                }}
                onBlur={() => void saveInterval()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveInterval();
                  }
                }}
                style={{ ...input(intervalInvalid), width: '120px' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>hours</span>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void saveInterval()}
                disabled={savedInterval === null || saving || intervalInput.trim() === String(savedInterval)}
                style={button('secondary', savedInterval === null || saving || intervalInput.trim() === String(savedInterval), 'sm')}
              >
                Save
              </button>
              <span style={{ fontSize: '12px', minHeight: '16px' }} aria-live="polite">
                {saving ? (
                  <span style={{ color: 'var(--admin-text-muted)' }}>Saving…</span>
                ) : savedFlash ? (
                  <span style={{ color: OK, fontWeight: 600 }}>Saved</span>
                ) : savedInterval === 0 ? (
                  <span style={{ color: 'var(--admin-text-muted)' }}>Auto sync is off.</span>
                ) : null}
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="Last synced"
            description="Price sync runs automatically in the background. You can also trigger it manually from the dashboard."
          >
            <div style={{ ...infoBox, padding: '8px 12px' }}>
              <span style={{ fontWeight: 500 }}>{savedInterval === null ? 'Loading…' : formatLastSync(lastSyncAt)}</span>
            </div>
          </SettingRow>
        </>
      )}

      {error ? (
        <p role="alert" style={flash('error')}>
          {error}
        </p>
      ) : null}
    </SubBlock>
  );
}

type ImageStorageMode = 'link' | 'firebase';

type ImageStorageResponse = { imageStorageMode?: string; storageBucketConfigured?: boolean; error?: string };

const IMAGE_STORAGE_OPTIONS: { value: ImageStorageMode; label: string; description: string }[] = [
  {
    value: 'link',
    label: 'External Links',
    description: 'Store image URLs as provided in the supplier sheet. Simple, no extra setup.',
  },
  {
    value: 'firebase',
    label: 'Firebase Storage',
    description:
      'Download and re-upload images to Firebase Storage for stable hosting. Requires FIREBASE_STORAGE_BUCKET env var.',
  },
];

function toImageStorageMode(value: unknown): ImageStorageMode {
  return value === 'firebase' ? 'firebase' : 'link';
}

/**
 * Image storage mode (External Links vs Firebase Storage). Saved on its own as soon as
 * an option is picked — not by the main Save button.
 */
function ImageStorageSection() {
  const [mode, setMode] = useState<ImageStorageMode | null>(null);
  const [bucketConfigured, setBucketConfigured] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as ImageStorageResponse;
        if (!response.ok) throw new Error(data.error || 'Could not load image storage settings.');
        if (!cancelled) {
          setMode(toImageStorageMode(data.imageStorageMode));
          setBucketConfigured(data.storageBucketConfigured === true);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load image storage settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  const saveMode = async (next: ImageStorageMode) => {
    if (mode === null || saving || next === mode) return;
    const previous = mode;
    setMode(next);
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageStorageMode: next }),
      });
      const data = (await response.json().catch(() => ({}))) as ImageStorageResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save image storage mode.');
      setMode(toImageStorageMode(data.imageStorageMode));
      if (typeof data.storageBucketConfigured === 'boolean') setBucketConfigured(data.storageBucketConfigured);
      setSavedFlash(true);
    } catch (err) {
      setMode(previous);
      setError(err instanceof Error ? err.message : 'Could not save image storage mode.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = mode === null || saving;

  return (
    <SubBlock title="Image Storage">
      {loadError ? (
        <p role="alert" style={{ ...flash('error'), margin: 0 }}>
          {loadError}
        </p>
      ) : (
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }} aria-describedby="image-storage-description">
          <legend style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, margin: '0 0 4px', padding: 0 }}>
            Where product images are stored
          </legend>
          <p id="image-storage-description" style={{ ...hint, margin: '0 0 12px' }}>
            Applies to images saved from now on. Saves as soon as you pick an option.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {IMAGE_STORAGE_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    border: `1px solid ${selected ? '#0F1623' : 'var(--admin-border)'}`,
                    background: selected ? '#FDFAF6' : '#FFFFFF',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  <input
                    type="radio"
                    name="image-storage-mode"
                    value={option.value}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => void saveMode(option.value)}
                    style={{ marginTop: '3px', accentColor: '#0F1623' }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 500 }}>{option.label}</span>
                    <span style={{ display: 'block', ...hint, margin: '2px 0 0' }}>{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {mode !== null && !bucketConfigured ? (
            <div role="note" style={{ ...warnBox, marginTop: '12px' }}>
              Set FIREBASE_STORAGE_BUCKET in your environment to enable Firebase Storage.
              {mode === 'firebase' ? ' Until then, images keep their external links.' : null}
            </div>
          ) : null}

          <p style={{ fontSize: '12px', minHeight: '16px', margin: '8px 0 0' }} aria-live="polite">
            {saving ? (
              <span style={{ color: 'var(--admin-text-muted)' }}>Saving…</span>
            ) : savedFlash ? (
              <span style={{ color: OK, fontWeight: 600 }}>Saved</span>
            ) : null}
          </p>
        </fieldset>
      )}

      {error ? (
        <p role="alert" style={flash('error')}>
          {error}
        </p>
      ) : null}
    </SubBlock>
  );
}

type PickupPincodeResponse = { pickupPincode?: string; error?: string };

/**
 * Warehouse pickup pincode used for courier delivery checks. Saved on its own (not by the
 * main Save button) and needs the admin TPIN, which is checked on the server.
 */
function PickupPincodeSection() {
  const [savedPincode, setSavedPincode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tpin, setTpin] = useState('');
  const [pincode, setPincode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as PickupPincodeResponse;
        if (!response.ok || typeof data.pickupPincode !== 'string') {
          throw new Error(data.error || 'Could not load pickup pincode.');
        }
        if (!cancelled) setSavedPincode(data.pickupPincode);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load pickup pincode.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeForm = () => {
    setEditing(false);
    setTpin('');
    setPincode('');
    setError(null);
  };

  const trimmedPincode = pincode.trim();
  const pincodeInvalid = trimmedPincode !== '' && !/^\d{6}$/.test(trimmedPincode);
  const saveDisabled = saving || !tpin.trim() || !/^\d{6}$/.test(trimmedPincode);

  const savePincode = async () => {
    if (!tpin.trim()) {
      setError('Enter your TPIN.');
      return;
    }
    if (!/^\d{6}$/.test(trimmedPincode)) {
      setError('Pickup pincode must be exactly 6 digits.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpin: tpin.trim(), pickupPincode: trimmedPincode }),
      });
      const data = (await response.json().catch(() => ({}))) as PickupPincodeResponse;
      if (!response.ok || typeof data.pickupPincode !== 'string') {
        throw new Error(data.error || 'Could not save pickup pincode.');
      }
      setSavedPincode(data.pickupPincode);
      closeForm();
      setMessage(`Pickup pincode saved. Delivery checks now use ${data.pickupPincode}.`);
    } catch (err) {
      setTpin('');
      setError(err instanceof Error ? err.message : 'Could not save pickup pincode.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubBlock title="Warehouse Pickup Pincode">
      <SettingRow
        label="Pickup pincode"
        first
        description="The pincode orders ship from. Courier delivery checks at checkout use it."
      >
        {loadError ? (
          <p role="alert" style={{ ...flash('error'), margin: '8px 0 0' }}>
            {loadError}
          </p>
        ) : savedPincode === null ? (
          <p style={{ ...flash('muted'), margin: '8px 0 0' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ ...infoBox, padding: '8px 12px', fontFamily: MONO, fontWeight: 600, flex: '0 0 auto' }}>
              {savedPincode || 'not set'}
            </span>
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setPincode(savedPincode ?? '');
                  setMessage(null);
                  setError(null);
                }}
                style={button('secondary', false, 'sm')}
              >
                Change
              </button>
            ) : null}
          </div>
        )}
      </SettingRow>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--admin-border)', marginTop: '4px' }}>
          <TpinNotice />
          <div>
            <label htmlFor="pickup-tpin" style={fieldLabel}>
              TPIN
            </label>
            <input
              id="pickup-tpin"
              className="vl-input"
              type="password"
              autoComplete="off"
              placeholder="Enter TPIN"
              value={tpin}
              disabled={saving}
              onChange={(event) => setTpin(event.target.value)}
              style={{ ...input(), maxWidth: '240px' }}
            />
          </div>
          <div>
            <label htmlFor="pickup-pincode" style={fieldLabel}>
              New pickup pincode
            </label>
            <input
              id="pickup-pincode"
              className="vl-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="e.g. 395011"
              value={pincode}
              aria-invalid={pincodeInvalid}
              disabled={saving}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...input(pincodeInvalid), maxWidth: '240px', fontFamily: MONO }}
            />
            <p style={{ ...hint, color: pincodeInvalid ? DANGER : hint.color }}>
              {pincodeInvalid ? 'Enter exactly 6 digits.' : 'Must be exactly 6 digits.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void savePincode()} disabled={saveDisabled} style={button('primary', saveDisabled)}>
              {saving ? 'Saving…' : 'Save Pincode'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} style={button('ghost', saving)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p role="status" style={flash('ok')}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={flash('error')}>
          {error}
        </p>
      ) : null}
    </SubBlock>
  );
}


type EkartStatus = {
  configured: boolean;
  source: 'env' | 'firestore' | 'none';
  hasClientId: boolean;
  hasToken: boolean;
};
type EkartStatusResponse = { ekartStatus?: EkartStatus; error?: string };
type EkartFields = { clientId: string; username: string; password: string; staticToken: string; baseUrl: string };
const EMPTY_EKART_FIELDS: EkartFields = { clientId: '', username: '', password: '', staticToken: '', baseUrl: '' };

const EKART_SOURCE_LABELS: Record<EkartStatus['source'], string> = {
  env: 'server environment variables',
  firestore: 'saved admin settings',
  none: 'not set',
};

/** Reads only the Ekart status flags from the settings API (never credential values). */
async function loadEkartStatus(): Promise<EkartStatus> {
  const response = await fetch('/api/admin/settings', { cache: 'no-store' });
  const data = (await response.json().catch(() => ({}))) as EkartStatusResponse;
  if (!response.ok || !data.ekartStatus || typeof data.ekartStatus.configured !== 'boolean') {
    throw new Error(data.error || 'Could not load Ekart status.');
  }
  return data.ekartStatus;
}

/**
 * Ekart courier API credentials. Saved on their own (not by the main Save button) and need the
 * admin TPIN, which is checked on the server. Saved values are never sent back to the browser.
 */
function EkartSection() {
  const [status, setStatus] = useState<EkartStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tpin, setTpin] = useState('');
  const [fields, setFields] = useState<EkartFields>(EMPTY_EKART_FIELDS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadEkartStatus();
        if (!cancelled) setStatus(result);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load Ekart status.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeForm = () => {
    setEditing(false);
    setTpin('');
    setFields(EMPTY_EKART_FIELDS);
    setError(null);
  };

  const trimmed: EkartFields = {
    clientId: fields.clientId.trim(),
    username: fields.username.trim(),
    password: fields.password.trim(),
    staticToken: fields.staticToken.trim(),
    baseUrl: fields.baseUrl.trim(),
  };
  const baseUrlInvalid = trimmed.baseUrl !== '' && !/^https?:\/\/\S+$/i.test(trimmed.baseUrl);
  const anyField = Object.values(trimmed).some((value) => value !== '');
  const saveDisabled = saving || !tpin.trim() || !anyField || baseUrlInvalid;

  const saveConfig = async () => {
    if (!tpin.trim()) {
      setError('Enter your TPIN.');
      return;
    }
    if (baseUrlInvalid) {
      setError('Base URL must start with https://');
      return;
    }
    if (!anyField) {
      setError('Fill in at least one field to save.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // Only send filled-in fields, so blank ones keep their saved value.
      const ekartConfig: Partial<EkartFields> = {};
      for (const [key, value] of Object.entries(trimmed) as [keyof EkartFields, string][]) {
        if (value) ekartConfig[key] = value;
      }
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpin: tpin.trim(), ekartConfig }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || data.success !== true) {
        throw new Error(data.error || 'Could not save Ekart config.');
      }
      closeForm();
      try {
        setStatus(await loadEkartStatus());
      } catch {
        // Saved fine; the status box just won't refresh until the page is reloaded.
      }
      setMessage('Ekart config saved. Delivery checks will use it right away.');
    } catch (err) {
      setTpin('');
      setError(err instanceof Error ? err.message : 'Could not save Ekart config.');
    } finally {
      setSaving(false);
    }
  };

  const textFields: { key: keyof EkartFields; id: string; label: string; type: 'text' | 'password' | 'url'; placeholder: string }[] = [
    { key: 'clientId', id: 'ekart-client-id', label: 'Client ID', type: 'text', placeholder: 'Leave blank to keep current' },
    { key: 'username', id: 'ekart-username', label: 'Username', type: 'text', placeholder: 'Leave blank to keep current' },
    { key: 'password', id: 'ekart-password', label: 'Password', type: 'password', placeholder: 'Leave blank to keep current' },
    { key: 'staticToken', id: 'ekart-static-token', label: 'Static Token (optional)', type: 'password', placeholder: 'Leave blank to keep current' },
    { key: 'baseUrl', id: 'ekart-base-url', label: 'Base URL (optional)', type: 'url', placeholder: 'https://app.elite.ekartlogistics.in' },
  ];

  return (
    <SubBlock title="Ekart Courier API">
      <p style={{ ...hint, margin: '0 0 4px' }}>
        Used to check whether Ekart can deliver to a customer&apos;s pincode. Saved credential values are never sent back to the
        browser.
      </p>

      {loadError ? (
        <p role="alert" style={flash('error')}>
          {loadError}
        </p>
      ) : status === null ? (
        <p style={flash('muted')}>Loading…</p>
      ) : (
        <>
          <SettingRow label="Status" first>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: status.configured ? OK : DANGER }}>
                {status.configured ? 'Configured ✓' : 'Not configured'}
              </span>
              {status.configured ? (
                <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Using: {EKART_SOURCE_LABELS[status.source]}</span>
              ) : null}
            </div>
          </SettingRow>
          <SettingRow label="Client ID">
            <span style={{ ...infoBox, display: 'inline-block', padding: '8px 12px', fontFamily: MONO }}>
              {status.hasClientId ? '••••••••' : 'not set'}
            </span>
          </SettingRow>
          <SettingRow label="Static token">
            <span style={{ ...infoBox, display: 'inline-block', padding: '8px 12px', fontFamily: MONO }}>
              {status.hasToken ? '••••••••' : 'not set'}
            </span>
          </SettingRow>
        </>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage(null);
            setError(null);
          }}
          style={{ ...button('secondary', false, 'sm'), marginTop: '8px' }}
        >
          {status?.configured ? 'Change Ekart Config' : 'Set Up Ekart'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--admin-border)', marginTop: '8px' }}>
          <TpinNotice />
          <div>
            <label htmlFor="ekart-tpin" style={fieldLabel}>
              TPIN
            </label>
            <input
              id="ekart-tpin"
              className="vl-input"
              type="password"
              autoComplete="off"
              placeholder="Enter TPIN"
              value={tpin}
              disabled={saving}
              onChange={(event) => setTpin(event.target.value)}
              style={{ ...input(), maxWidth: '240px' }}
            />
          </div>
          {textFields.map((field) => {
            const invalid = field.key === 'baseUrl' && baseUrlInvalid;
            return (
              <div key={field.key}>
                <label htmlFor={field.id} style={fieldLabel}>
                  {field.label}
                </label>
                <input
                  id={field.id}
                  className="vl-input"
                  type={field.type}
                  autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={fields[field.key]}
                  aria-invalid={invalid}
                  disabled={saving}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFields((current) => ({ ...current, [field.key]: value }));
                  }}
                  style={input(invalid)}
                />
                {invalid ? <p style={{ ...hint, color: DANGER }}>Base URL must start with https://</p> : null}
              </div>
            );
          })}
          <p style={{ ...hint, margin: 0 }}>Leave a field blank to keep existing value. Static token overrides username/password auth.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void saveConfig()} disabled={saveDisabled} style={button('primary', saveDisabled)}>
              {saving ? 'Saving…' : 'Save Ekart Config'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} style={button('ghost', saving)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role="status" style={flash('ok')}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={flash('error')}>
          {error}
        </p>
      ) : null}
    </SubBlock>
  );
}


type PaymentResponse = { razorpayKeyId?: string; hasSecret?: boolean; error?: string };

/**
 * Razorpay key management. Saved on its own (not by the main Save button) and needs the
 * admin TPIN, which is checked on the server. The full secret is never sent to the browser.
 */
function PaymentSettingsSection() {
  const [maskedKeyId, setMaskedKeyId] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tpin, setTpin] = useState('');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyResponse = (data: PaymentResponse) => {
    setMaskedKeyId(typeof data.razorpayKeyId === 'string' ? data.razorpayKeyId : '');
    setHasSecret(data.hasSecret === true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/payment', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as PaymentResponse;
        if (!response.ok) throw new Error(data.error || 'Could not load payment settings.');
        if (!cancelled) applyResponse(data);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load payment settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeForm = () => {
    setEditing(false);
    setTpin('');
    setKeyId('');
    setKeySecret('');
    setError(null);
  };

  const trimmedKeyId = keyId.trim();
  const keyIdInvalid = trimmedKeyId !== '' && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(trimmedKeyId);
  const saveDisabled = saving || !tpin.trim() || (!trimmedKeyId && !keySecret.trim()) || keyIdInvalid;

  const saveKeys = async () => {
    if (!tpin.trim()) {
      setError('Enter your TPIN.');
      return;
    }
    if (keyIdInvalid) {
      setError('Key ID must start with rzp_test_ or rzp_live_.');
      return;
    }
    if (!trimmedKeyId && !keySecret.trim()) {
      setError('Enter a new key ID or key secret.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, string> = { tpin: tpin.trim() };
      if (trimmedKeyId) body.razorpayKeyId = trimmedKeyId;
      if (keySecret.trim()) body.razorpayKeySecret = keySecret.trim();
      const response = await fetch('/api/admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as PaymentResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save payment keys.');
      applyResponse(data);
      closeForm();
      setMessage('Payment keys saved. New payments will use them right away.');
    } catch (err) {
      setTpin('');
      setError(err instanceof Error ? err.message : 'Could not save payment keys.');
    } finally {
      setSaving(false);
    }
  };

  const mode = maskedKeyId?.startsWith('rzp_live_') ? 'Live' : maskedKeyId?.startsWith('rzp_test_') ? 'Test' : null;

  return (
    <SubBlock title="Razorpay">
      <p style={{ ...hint, margin: '0 0 4px' }}>
        Razorpay API keys used for online payments. The full secret is never sent to the browser.
      </p>

      {loadError ? (
        <p role="alert" style={flash('error')}>
          {loadError}
        </p>
      ) : maskedKeyId === null ? (
        <p style={flash('muted')}>Loading…</p>
      ) : (
        <>
          <SettingRow label="Key ID" first>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ ...infoBox, display: 'inline-block', padding: '8px 12px', fontFamily: MONO, fontWeight: 600 }}>
                {maskedKeyId || 'not configured'}
              </span>
              {mode ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    padding: '3px 8px',
                    border: `1px solid ${mode === 'Live' ? OK : AMBER}`,
                    color: mode === 'Live' ? OK : AMBER,
                  }}
                >
                  {mode} mode
                </span>
              ) : null}
            </div>
          </SettingRow>
          <SettingRow label="Key secret">
            <span
              style={{
                ...infoBox,
                display: 'inline-block',
                padding: '8px 12px',
                fontFamily: MONO,
                color: hasSecret ? 'var(--admin-text)' : DANGER,
              }}
            >
              {hasSecret ? '••••••••••••' : 'not configured'}
            </span>
          </SettingRow>
        </>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage(null);
            setError(null);
          }}
          style={{ ...button('secondary', false, 'sm'), marginTop: '8px' }}
        >
          Change Keys
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--admin-border)', marginTop: '8px' }}>
          <TpinNotice />
          <div>
            <label htmlFor="payment-tpin" style={fieldLabel}>
              TPIN
            </label>
            <input
              id="payment-tpin"
              className="vl-input"
              type="password"
              autoComplete="off"
              placeholder="Enter TPIN"
              value={tpin}
              disabled={saving}
              onChange={(event) => setTpin(event.target.value)}
              style={{ ...input(), maxWidth: '240px' }}
            />
          </div>
          <div>
            <label htmlFor="payment-key-id" style={fieldLabel}>
              Key ID
            </label>
            <input
              id="payment-key-id"
              className="vl-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="rzp_test_... or rzp_live_..."
              value={keyId}
              aria-invalid={keyIdInvalid}
              disabled={saving}
              onChange={(event) => setKeyId(event.target.value)}
              style={{ ...input(keyIdInvalid), fontFamily: MONO }}
            />
            <p style={{ ...hint, color: keyIdInvalid ? DANGER : hint.color }}>
              {keyIdInvalid ? 'Key ID must start with rzp_test_ or rzp_live_.' : 'Leave blank to keep the current key ID. The prefix sets test or live mode.'}
            </p>
          </div>
          <div>
            <label htmlFor="payment-key-secret" style={fieldLabel}>
              Key Secret
            </label>
            <input
              id="payment-key-secret"
              className="vl-input"
              type="password"
              autoComplete="off"
              placeholder="Leave blank to keep current"
              value={keySecret}
              disabled={saving}
              onChange={(event) => setKeySecret(event.target.value)}
              style={input()}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void saveKeys()} disabled={saveDisabled} style={button('primary', saveDisabled)}>
              {saving ? 'Saving…' : 'Save Keys'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} style={button('ghost', saving)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role="status" style={flash('ok')}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={flash('error')}>
          {error}
        </p>
      ) : null}
    </SubBlock>
  );
}
