'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/** Must match MAX_FREE_SHIPPING_THRESHOLD in lib/settings.ts (the API enforces it). */
const MAX_FREE_SHIPPING_THRESHOLD = 100000;
/** Must match MAX_RETURN_WINDOW_DAYS in lib/settings.ts (the API enforces it). */
const MAX_RETURN_WINDOW_DAYS = 90;

type SettingsResponse = {
  codEnabled?: boolean;
  freeShippingThreshold?: number;
  returnWindowByCategory?: Record<string, number>;
  socialLinks?: Partial<SocialLinks>;
  error?: string;
};

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

export default function AdminSettingsPage() {
  /** What is saved in the database right now. */
  const [savedCod, setSavedCod] = useState<boolean | null>(null);
  /** What the switch currently shows (may be unsaved). */
  const [codEnabled, setCodEnabled] = useState(true);
  /** Free-shipping threshold saved in the database right now. */
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  /** What the threshold box currently shows (may be unsaved or not yet valid). */
  const [thresholdInput, setThresholdInput] = useState('');
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
          applySavedWindows(data.returnWindowByCategory);
          applySavedSocial(data.socialLinks);
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

  const save = async () => {
    if (threshold === null) {
      setError(`Free shipping threshold must be a whole number between 0 and ${formatRupees(MAX_FREE_SHIPPING_THRESHOLD)}.`);
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
    const trimmedSocial = toSocialLinks(
      Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, socialLinks[key].trim()])) as Partial<SocialLinks>,
    );
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codEnabled,
          freeShippingThreshold: threshold,
          returnWindowByCategory: windows.map,
          socialLinks: trimmedSocial,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as SettingsResponse;
      if (
        !response.ok ||
        typeof data.codEnabled !== 'boolean' ||
        typeof data.freeShippingThreshold !== 'number' ||
        typeof data.returnWindowByCategory !== 'object' ||
        data.returnWindowByCategory === null
      ) {
        throw new Error(data.error || 'Could not save settings.');
      }
      setSavedCod(data.codEnabled);
      setCodEnabled(data.codEnabled);
      setSavedThreshold(data.freeShippingThreshold);
      setThresholdInput(String(data.freeShippingThreshold));
      applySavedWindows(data.returnWindowByCategory);
      applySavedSocial(data.socialLinks);
      setMessage(
        `Saved. Cash on Delivery is now ${data.codEnabled ? 'ON' : 'OFF'}, shipping is free on orders of ${formatRupees(data.freeShippingThreshold)} or more, and the default return window is ${data.returnWindowByCategory.default} days.`,
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
    (savedWindowsSnapshot !== null && savedWindowsSnapshot !== windowsSnapshot(defaultDays, categoryRows)) ||
    (savedSocialSnapshot !== null && savedSocialSnapshot !== socialSnapshot(socialLinks));
  const notLoaded =
    savedCod === null || savedThreshold === null || savedWindowsSnapshot === null || savedSocialSnapshot === null;
  const socialDisabled = savedSocialSnapshot === null || saving;
  const saveDisabled = saving || notLoaded || !unsaved || thresholdInvalid;

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
        {error ? (
          <p role="alert" style={{ margin: '16px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
