'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { BrandPromiseIcon as BrandPromiseIconSvg } from '@/components/home/BrandPromiseIcon';

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

  const inputStyle = (invalid: boolean): CSSProperties => ({
    padding: '10px 12px',
    fontSize: '15px',
    border: `1px solid ${invalid ? '#9A3B1E' : '#ccc'}`,
    borderRadius: '6px',
    background: '#fff',
    minWidth: 0,
  });

  const smallButtonStyle: CSSProperties = {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: windowsDisabled ? 'not-allowed' : 'pointer',
    opacity: windowsDisabled ? 0.5 : 1,
    flexShrink: 0,
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Settings</h1>

      <section style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '24px' }}>
        {loading ? (
          <p style={{ margin: 0, color: '#6F6A62' }}>Loading…</p>
        ) : (
          <>
            {savedCod !== null ? (
              <p
                style={{
                  margin: '0 0 20px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 600,
                  background: savedCod ? '#E0F2E9' : '#F5E1DA',
                  color: savedCod ? '#1E6B45' : '#9A3B1E',
                }}
              >
                COD is currently {savedCod ? 'ON' : 'OFF'}
              </p>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
              <div>
                <h2 id="cod-label" style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>
                  Cash on Delivery
                </h2>
                <p id="cod-description" style={{ fontSize: '14px', color: '#6F6A62', margin: 0, lineHeight: 1.5 }}>
                  When enabled, customers can choose to pay cash when the order arrives.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={codEnabled}
                aria-labelledby="cod-label"
                aria-describedby="cod-description"
                disabled={savedCod === null || saving}
                onClick={() => {
                  setCodEnabled((value) => !value);
                  setMessage(null);
                }}
                style={{
                  flexShrink: 0,
                  position: 'relative',
                  width: '56px',
                  height: '30px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: savedCod === null || saving ? 'not-allowed' : 'pointer',
                  background: codEnabled ? '#1E6B45' : '#bbb',
                  transition: 'background 0.2s',
                  padding: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: codEnabled ? '29px' : '3px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 0', textAlign: 'right', color: codEnabled ? '#1E6B45' : '#6F6A62' }}>
              {codEnabled ? 'ON' : 'OFF'}
            </p>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Shipping
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
                <div>
                  <label htmlFor="free-shipping-threshold" style={{ display: 'block', fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>
                    Free Shipping Threshold (₹)
                  </label>
                  <p id="free-shipping-description" style={{ fontSize: '14px', color: '#6F6A62', margin: 0, lineHeight: 1.5 }}>
                    Orders at or above this amount ship free. Below it, a flat delivery fee is charged. The cart progress bar and
                    checkout both use this value.
                  </p>
                  {savedThreshold !== null ? (
                    <p style={{ fontSize: '13px', color: '#6F6A62', margin: '8px 0 0' }}>
                      Currently: free shipping on orders of {formatRupees(savedThreshold)} or more.
                    </p>
                  ) : null}
                </div>

                <input
                  id="free-shipping-threshold"
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
                  style={{
                    flexShrink: 0,
                    width: '140px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    border: `1px solid ${thresholdInvalid ? '#9A3B1E' : '#ccc'}`,
                    borderRadius: '6px',
                    background: '#fff',
                  }}
                />
              </div>
              {thresholdInvalid ? (
                <p style={{ fontSize: '13px', margin: '8px 0 0', textAlign: 'right', color: '#9A3B1E' }}>
                  Enter a whole number from 0 to {formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.
                </p>
              ) : null}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', marginTop: '20px' }}>
                <div>
                  <label htmlFor="flat-shipping-fee" style={{ display: 'block', fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>
                    Flat Shipping Fee (₹)
                  </label>
                  <p id="flat-shipping-fee-description" style={{ fontSize: '14px', color: '#6F6A62', margin: 0, lineHeight: 1.5 }}>
                    Charged when the order total is below the free shipping threshold.
                  </p>
                  {savedShippingFee !== null ? (
                    <p style={{ fontSize: '13px', color: '#6F6A62', margin: '8px 0 0' }}>
                      Currently: {formatRupees(savedShippingFee)} per order below the free shipping threshold.
                    </p>
                  ) : null}
                </div>

                <input
                  id="flat-shipping-fee"
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
                  style={{
                    flexShrink: 0,
                    width: '140px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    border: `1px solid ${shippingFeeInvalid ? '#9A3B1E' : '#ccc'}`,
                    borderRadius: '6px',
                    background: '#fff',
                  }}
                />
              </div>
              {shippingFeeInvalid ? (
                <p style={{ fontSize: '13px', margin: '8px 0 0', textAlign: 'right', color: '#9A3B1E' }}>
                  Enter a whole number from 0 to {formatRupees(MAX_SHIPPING_FEE)}.
                </p>
              ) : null}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Return Windows
              </h2>
              <p id="return-windows-description" style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 16px', lineHeight: 1.5 }}>
                Set how many days customers have to return or exchange an item, by product category.
              </p>

              <div
                aria-hidden="true"
                style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600, color: '#6F6A62', margin: '0 0 6px' }}
              >
                <span style={{ flex: 1 }}>Category</span>
                <span style={{ width: '90px' }}>Days</span>
                <span style={{ width: '76px' }} />
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="text"
                    value="Default (all products)"
                    disabled
                    aria-label="Category name"
                    style={{ ...inputStyle(false), flex: 1, background: '#F6F1E8', color: '#1C2230' }}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_RETURN_WINDOW_DAYS}
                    step={1}
                    value={defaultDays}
                    aria-label="Default return window in days"
                    aria-describedby="return-windows-description"
                    aria-invalid={defaultDaysInvalid}
                    disabled={windowsDisabled}
                    onChange={(event) => {
                      setDefaultDays(event.target.value);
                      setMessage(null);
                    }}
                    style={{ ...inputStyle(defaultDaysInvalid), width: '90px', flexShrink: 0 }}
                  />
                  <span style={{ width: '76px', flexShrink: 0 }} />
                </li>

                {categoryRows.map((row) => {
                  const nameInvalid = row.name.trim() === '' || row.name.trim().toLowerCase() === 'default';
                  const daysInvalid = parseDays(row.days) === null;
                  return (
                    <li key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="text"
                        value={row.name}
                        placeholder="e.g. Shirts"
                        aria-label="Category name"
                        aria-invalid={nameInvalid}
                        disabled={windowsDisabled}
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                        style={{ ...inputStyle(nameInvalid), flex: 1 }}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_RETURN_WINDOW_DAYS}
                        step={1}
                        value={row.days}
                        aria-label={`Return window in days for ${row.name.trim() || 'this category'}`}
                        aria-invalid={daysInvalid}
                        disabled={windowsDisabled}
                        onChange={(event) => updateRow(row.id, { days: event.target.value })}
                        style={{ ...inputStyle(daysInvalid), width: '90px', flexShrink: 0 }}
                      />
                      <button
                        type="button"
                        disabled={windowsDisabled}
                        onClick={() => {
                          setCategoryRows((rows) => rows.filter((r) => r.id !== row.id));
                          setMessage(null);
                        }}
                        aria-label={`Remove ${row.name.trim() || 'this category'}`}
                        style={{ ...smallButtonStyle, width: '76px', color: '#9A3B1E' }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                disabled={windowsDisabled}
                onClick={() => {
                  setCategoryRows((rows) => [...rows, { id: nextRowId++, name: '', days: defaultDays.trim() || '7' }]);
                  setMessage(null);
                }}
                style={{ ...smallButtonStyle, marginTop: '12px' }}
              >
                + Add Category
              </button>
              <p style={{ fontSize: '13px', color: '#6F6A62', margin: '8px 0 0' }}>
                Days must be a whole number from 1 to {MAX_RETURN_WINDOW_DAYS}.
              </p>
            </div>

            <PaymentSettingsSection />

            <PickupPincodeSection />

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Stock Defaults
              </h2>
              <fieldset style={{ border: 'none', margin: 0, padding: 0 }} aria-describedby="stock-default-description">
                <legend style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px', padding: 0 }}>
                  When stock can&apos;t be found
                </legend>
                <p id="stock-default-description" style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Used for supplier products when their sheet has no stock column and the inventory sheet has no row for them.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                          border: `1px solid ${selected ? '#1C2230' : '#e5e5e5'}`,
                          borderRadius: '6px',
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
                          style={{ marginTop: '3px' }}
                        />
                        <span>
                          <span style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>{option.label}</span>
                          <span style={{ display: 'block', fontSize: '13px', color: '#6F6A62', marginTop: '2px', lineHeight: 1.5 }}>
                            {option.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Brand Promise
              </h2>
              <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 16px', lineHeight: 1.5 }}>
                The dark strip of promises on the homepage. Add {MIN_BRAND_PROMISE_ITEMS} to {MAX_BRAND_PROMISE_ITEMS} items, pick an icon
                for each, and use the arrows to change the order.
              </p>

              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {brandPromise.map((row, index) => {
                  const titleId = `promise-title-${row.id}`;
                  const descId = `promise-desc-${row.id}`;
                  const titleInvalid = row.title.trim() === '' || row.title.trim().length > MAX_BRAND_PROMISE_TITLE;
                  const descInvalid = row.description.trim().length > MAX_BRAND_PROMISE_DESC;
                  const promiseButtonStyle = (disabled: boolean): CSSProperties => ({
                    ...smallButtonStyle,
                    padding: '6px 10px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                  });
                  const upDisabled = promiseDisabled || index === 0;
                  const downDisabled = promiseDisabled || index === brandPromise.length - 1;
                  const removeDisabled = promiseDisabled || brandPromise.length <= MIN_BRAND_PROMISE_ITEMS;
                  return (
                    <li key={row.id} style={{ border: '1px solid #e5e5e5', borderRadius: '6px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Item {index + 1}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={upDisabled}
                            onClick={() => movePromise(index, -1)}
                            aria-label={`Move item ${index + 1} up`}
                            style={promiseButtonStyle(upDisabled)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={downDisabled}
                            onClick={() => movePromise(index, 1)}
                            aria-label={`Move item ${index + 1} down`}
                            style={promiseButtonStyle(downDisabled)}
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
                            style={{ ...promiseButtonStyle(removeDisabled), color: '#9A3B1E' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <fieldset style={{ border: 'none', margin: '0 0 12px', padding: 0 }}>
                        <legend style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 6px', padding: 0 }}>Icon</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '6px' }}>
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
                                  border: `${selected ? 2 : 1}px solid ${selected ? '#1C2230' : '#e5e5e5'}`,
                                  borderRadius: '6px',
                                  background: selected ? '#F6F1E8' : '#fff',
                                  color: '#1C2230',
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
                                <BrandPromiseIconSvg icon={icon} size={22} />
                                <span style={{ fontSize: '11px' }}>{BRAND_PROMISE_ICON_LABELS[icon]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      <label htmlFor={titleId} style={{ display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 6px' }}>
                        Title
                      </label>
                      <input
                        id={titleId}
                        type="text"
                        value={row.title}
                        maxLength={MAX_BRAND_PROMISE_TITLE}
                        placeholder="e.g. Free Shipping"
                        aria-invalid={titleInvalid}
                        disabled={promiseDisabled}
                        onChange={(event) => updatePromise(row.id, { title: event.target.value })}
                        style={{ ...inputStyle(titleInvalid), width: '100%', boxSizing: 'border-box' }}
                      />
                      <p style={{ fontSize: '12px', color: titleInvalid ? '#9A3B1E' : '#6F6A62', margin: '4px 0 12px', textAlign: 'right' }}>
                        {row.title.trim() === '' ? 'A title is required. ' : ''}
                        {row.title.length}/{MAX_BRAND_PROMISE_TITLE}
                      </p>

                      <label htmlFor={descId} style={{ display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 6px' }}>
                        Description
                      </label>
                      <textarea
                        id={descId}
                        value={row.description}
                        maxLength={MAX_BRAND_PROMISE_DESC}
                        rows={2}
                        placeholder="e.g. On all orders over ₹999, delivered across India."
                        aria-invalid={descInvalid}
                        disabled={promiseDisabled}
                        onChange={(event) => updatePromise(row.id, { description: event.target.value })}
                        style={{
                          ...inputStyle(descInvalid),
                          width: '100%',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                        }}
                      />
                      <p style={{ fontSize: '12px', color: descInvalid ? '#9A3B1E' : '#6F6A62', margin: '4px 0 0', textAlign: 'right' }}>
                        {row.description.length}/{MAX_BRAND_PROMISE_DESC}
                      </p>
                    </li>
                  );
                })}
              </ol>

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
                style={{
                  ...smallButtonStyle,
                  marginTop: '12px',
                  cursor: promiseDisabled || brandPromise.length >= MAX_BRAND_PROMISE_ITEMS ? 'not-allowed' : 'pointer',
                  opacity: promiseDisabled || brandPromise.length >= MAX_BRAND_PROMISE_ITEMS ? 0.5 : 1,
                }}
              >
                + Add Item
              </button>
              <p style={{ fontSize: '13px', color: '#6F6A62', margin: '8px 0 0' }}>
                {brandPromise.length} of {MAX_BRAND_PROMISE_ITEMS} items. The description text is shown exactly as written — if you
                change the free shipping threshold above, update it here too.
              </p>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
                Social Media
              </h2>
              <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 16px', lineHeight: 1.5 }}>
                Paste the full link to each profile. Icons appear in the website footer only for the links you fill in. Leave a box
                empty to hide that icon.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {SOCIAL_FIELDS.map((field) => {
                  const id = `social-${field.key}`;
                  const fieldError = socialLinkError(socialLinks[field.key]);
                  return (
                    <div key={field.key}>
                      <label htmlFor={id} style={{ display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' }}>
                        {field.label}
                      </label>
                      <input
                        id={id}
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
                        style={{ ...inputStyle(fieldError !== null), width: '100%', boxSizing: 'border-box' }}
                      />
                      {fieldError ? (
                        <p style={{ fontSize: '13px', margin: '6px 0 0', color: '#9A3B1E' }}>{fieldError}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saveDisabled}
                style={{
                  background: '#1C2230',
                  color: '#F6F1E8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: saveDisabled ? 'not-allowed' : 'pointer',
                  opacity: saveDisabled ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {unsaved ? <span style={{ fontSize: '13px', color: '#8A6100' }}>You have unsaved changes.</span> : null}
            </div>
          </>
        )}

        {message ? (
          <p role="status" style={{ margin: '16px 0 0', fontSize: '14px', color: '#1E6B45' }}>
            {message}
          </p>
        ) : null}
        {message && thresholdWarning ? (
          <p
            role="alert"
            style={{
              margin: '12px 0 0',
              padding: '10px 14px',
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#7A5200',
              background: '#FFF4D6',
              border: '1px solid #E8C468',
              borderRadius: '6px',
            }}
          >
            {thresholdWarning}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: '16px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
            {error}
          </p>
        ) : null}
      </section>
    </div>
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

  const fieldStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: '15px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };
  const secondaryButtonStyle: CSSProperties = {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.5 : 1,
  };

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
      <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
        Pickup Pincode
      </h2>
      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>Warehouse Pickup Pincode</h3>
      <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 14px', lineHeight: 1.5 }}>
        The pincode orders ship from. Courier delivery checks at checkout use it. Requires your admin transaction PIN.
      </p>

      {loadError ? (
        <p role="alert" style={{ fontSize: '14px', margin: '0 0 12px', color: '#9A3B1E' }}>
          {loadError}
        </p>
      ) : savedPincode === null ? (
        <p style={{ fontSize: '14px', margin: '0 0 12px', color: '#6F6A62' }}>Loading…</p>
      ) : (
        <div style={{ padding: '12px 14px', border: '1px solid #e5e5e5', borderRadius: '6px', fontSize: '14px', margin: '0 0 12px', lineHeight: 1.6 }}>
          Current pickup pincode: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{savedPincode}</span>
        </div>
      )}

      {!editing ? (
        <button
          type="button"
          disabled={savedPincode === null}
          onClick={() => {
            setEditing(true);
            setPincode(savedPincode ?? '');
            setMessage(null);
            setError(null);
          }}
          style={{
            ...secondaryButtonStyle,
            cursor: savedPincode === null ? 'not-allowed' : 'pointer',
            opacity: savedPincode === null ? 0.5 : 1,
          }}
        >
          Change Pincode
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', border: '1px solid #e5e5e5', borderRadius: '6px' }}>
          <div>
            <label htmlFor="pickup-tpin" style={labelStyle}>
              TPIN
            </label>
            <input
              id="pickup-tpin"
              type="password"
              autoComplete="off"
              placeholder="Enter TPIN"
              value={tpin}
              disabled={saving}
              onChange={(event) => setTpin(event.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label htmlFor="pickup-pincode" style={labelStyle}>
              Pickup Pincode
            </label>
            <input
              id="pickup-pincode"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="e.g. 395011"
              value={pincode}
              aria-invalid={pincodeInvalid}
              disabled={saving}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...fieldStyle, borderColor: pincodeInvalid ? '#9A3B1E' : '#ccc' }}
            />
            <p style={{ fontSize: '13px', margin: '6px 0 0', color: pincodeInvalid ? '#9A3B1E' : '#6F6A62' }}>
              {pincodeInvalid ? 'Enter exactly 6 digits.' : 'Must be exactly 6 digits.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void savePincode()}
              disabled={saveDisabled}
              style={{
                background: '#1C2230',
                color: '#F6F1E8',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
                opacity: saveDisabled ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Pincode'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role="status" style={{ margin: '12px 0 0', fontSize: '14px', color: '#1E6B45' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}
    </div>
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

  const fieldStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: '15px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };
  const secondaryButtonStyle: CSSProperties = {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.5 : 1,
  };

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
      <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6F6A62' }}>
        Payment
      </h2>
      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>Payment Settings</h3>
      <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 14px', lineHeight: 1.5 }}>
        Update Razorpay API keys. Requires your admin transaction PIN.
      </p>

      {loadError ? (
        <p role="alert" style={{ fontSize: '14px', margin: '0 0 12px', color: '#9A3B1E' }}>
          {loadError}
        </p>
      ) : maskedKeyId === null ? (
        <p style={{ fontSize: '14px', margin: '0 0 12px', color: '#6F6A62' }}>Loading…</p>
      ) : (
        <div style={{ padding: '12px 14px', border: '1px solid #e5e5e5', borderRadius: '6px', fontSize: '14px', margin: '0 0 12px', lineHeight: 1.6 }}>
          <div>
            Key ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{maskedKeyId || 'not configured'}</span>
          </div>
          <div style={{ color: hasSecret ? '#1E6B45' : '#9A3B1E' }}>Secret: {hasSecret ? 'set' : 'not configured'}</div>
        </div>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage(null);
            setError(null);
          }}
          style={secondaryButtonStyle}
        >
          Change Keys
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', border: '1px solid #e5e5e5', borderRadius: '6px' }}>
          <div>
            <label htmlFor="payment-tpin" style={labelStyle}>
              TPIN
            </label>
            <input
              id="payment-tpin"
              type="password"
              autoComplete="off"
              placeholder="Enter TPIN"
              value={tpin}
              disabled={saving}
              onChange={(event) => setTpin(event.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label htmlFor="payment-key-id" style={labelStyle}>
              Key ID
            </label>
            <input
              id="payment-key-id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="rzp_test_... or rzp_live_..."
              value={keyId}
              aria-invalid={keyIdInvalid}
              disabled={saving}
              onChange={(event) => setKeyId(event.target.value)}
              style={{ ...fieldStyle, borderColor: keyIdInvalid ? '#9A3B1E' : '#ccc' }}
            />
            <p style={{ fontSize: '13px', margin: '6px 0 0', color: keyIdInvalid ? '#9A3B1E' : '#6F6A62' }}>
              {keyIdInvalid ? 'Key ID must start with rzp_test_ or rzp_live_.' : 'Leave blank to keep the current key ID.'}
            </p>
          </div>
          <div>
            <label htmlFor="payment-key-secret" style={labelStyle}>
              Key Secret
            </label>
            <input
              id="payment-key-secret"
              type="password"
              autoComplete="off"
              placeholder="Leave blank to keep current"
              value={keySecret}
              disabled={saving}
              onChange={(event) => setKeySecret(event.target.value)}
              style={fieldStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void saveKeys()}
              disabled={saveDisabled}
              style={{
                background: '#1C2230',
                color: '#F6F1E8',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
                opacity: saveDisabled ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Keys'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role="status" style={{ margin: '12px 0 0', fontSize: '14px', color: '#1E6B45' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
