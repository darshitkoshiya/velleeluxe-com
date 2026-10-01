/**
 * Store-wide settings kept in Firestore at `config/settings` (server-only).
 * Changed from the admin panel at /admin/settings.
 */
import { unstable_cache } from 'next/cache';
import { getAdminDb } from './firebase-admin';
import { FREE_SHIPPING_THRESHOLD } from './utils';

export interface StoreSettings {
  /** When false, Cash on Delivery is hidden at checkout and rejected by the orders API. */
  codEnabled: boolean;
  /** Orders at or above this subtotal (INR) ship free. */
  freeShippingThreshold: number;
  /** Return window in days for each product category. The "default" key applies to all products. */
  returnWindowByCategory: Record<string, number>;
  /** Social media profile URLs shown in the footer. Empty string = hidden. */
  socialLinks: SocialLinks;
}

export interface SocialLinks {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  pinterest: string;
}

export const SOCIAL_LINK_KEYS = ['instagram', 'facebook', 'twitter', 'youtube', 'pinterest'] as const;
/** Longest social link URL the admin can save. */
export const MAX_SOCIAL_LINK_LENGTH = 300;

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  instagram: '',
  facebook: '',
  twitter: '',
  youtube: '',
  pinterest: '',
};

/** Keeps only known keys with string values from a stored/received object. */
function cleanSocialLinks(value: unknown): SocialLinks {
  const result: SocialLinks = { ...DEFAULT_SOCIAL_LINKS };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const key of SOCIAL_LINK_KEYS) {
    if (typeof input[key] === 'string') result[key] = (input[key] as string).trim();
  }
  return result;
}

/**
 * Validates socialLinks from a request body: an object whose known keys are
 * strings (empty or an http(s) URL) of at most MAX_SOCIAL_LINK_LENGTH characters.
 * Returns the cleaned links, or an error message.
 */
export function parseSocialLinks(value: unknown): { links: SocialLinks } | { error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'socialLinks must be an object.' };
  }
  const input = value as Record<string, unknown>;
  for (const key of SOCIAL_LINK_KEYS) {
    const link = input[key];
    if (link === undefined) continue;
    if (typeof link !== 'string') return { error: `The ${key} link must be text.` };
    const trimmed = link.trim();
    if (trimmed.length > MAX_SOCIAL_LINK_LENGTH) {
      return { error: `The ${key} link is too long (max ${MAX_SOCIAL_LINK_LENGTH} characters).` };
    }
    if (trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      return { error: `The ${key} link must be a full URL starting with https://` };
    }
  }
  return { links: cleanSocialLinks(input) };
}

/** Same value as RETURN_WINDOW_DAYS in lib/returns-shared.ts. */
export const DEFAULT_RETURN_WINDOW_DAYS = 7;
/** Longest return window the admin can set (days). */
export const MAX_RETURN_WINDOW_DAYS = 90;

/** Used when the settings document has not been created yet. */
export const DEFAULT_SETTINGS: StoreSettings = {
  codEnabled: true,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  returnWindowByCategory: { default: DEFAULT_RETURN_WINDOW_DAYS },
  socialLinks: DEFAULT_SOCIAL_LINKS,
};

/** Highest threshold the admin can set (INR) — guards against typos like 99999999. */
export const MAX_FREE_SHIPPING_THRESHOLD = 100000;

/** True for a plain object whose keys are non-empty strings and values whole days 1..MAX_RETURN_WINDOW_DAYS. */
export function isValidReturnWindowByCategory(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, days]) =>
      key.trim().length > 0 &&
      typeof days === 'number' &&
      Number.isInteger(days) &&
      days >= 1 &&
      days <= MAX_RETURN_WINDOW_DAYS,
  );
}

/** Cache tag for pages that show settings (revalidated when the admin saves). */
export const SETTINGS_CACHE_TAG = 'store-settings';

/** True for a whole-rupee amount between 0 and MAX_FREE_SHIPPING_THRESHOLD. */
export function isValidFreeShippingThreshold(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_FREE_SHIPPING_THRESHOLD
  );
}

function settingsRef() {
  return getAdminDb().collection('config').doc('settings');
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const snapshot = await settingsRef().get();
  const data = snapshot.exists ? snapshot.data() : undefined;
  return {
    codEnabled: typeof data?.codEnabled === 'boolean' ? data.codEnabled : DEFAULT_SETTINGS.codEnabled,
    freeShippingThreshold: isValidFreeShippingThreshold(data?.freeShippingThreshold)
      ? data.freeShippingThreshold
      : DEFAULT_SETTINGS.freeShippingThreshold,
    // Merge with the default so the "default" key always exists (older docs lack this field).
    returnWindowByCategory: {
      ...DEFAULT_SETTINGS.returnWindowByCategory,
      ...(isValidReturnWindowByCategory(data?.returnWindowByCategory) ? data.returnWindowByCategory : {}),
    },
    // Merge with empty defaults so every platform key always exists.
    socialLinks: cleanSocialLinks(data?.socialLinks),
  };
}

export async function updateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  const payload = { ...updates, updatedAt: new Date().toISOString() };
  // mergeFields (not merge: true) so map fields like returnWindowByCategory are replaced
  // wholesale — otherwise categories removed in the admin panel would never be deleted.
  await settingsRef().set(payload, { mergeFields: Object.keys(payload) });
  return getStoreSettings();
}

/**
 * Free-shipping threshold for server-rendered pages (homepage, about, contact, metadata).
 * Cached for 60 seconds and refreshed when the admin saves; falls back to the default
 * if Firestore is unavailable (e.g. during a build without secrets).
 */
export const getFreeShippingThreshold = unstable_cache(
  async (): Promise<number> => {
    try {
      return (await getStoreSettings()).freeShippingThreshold;
    } catch (error) {
      console.error('[settings] Could not read free-shipping threshold; using default:', error);
      return DEFAULT_SETTINGS.freeShippingThreshold;
    }
  },
  ['free-shipping-threshold'],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);
