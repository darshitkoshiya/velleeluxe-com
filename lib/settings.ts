/**
 * Store-wide settings kept in Firestore at `config/settings` (server-only).
 * Changed from the admin panel at /admin/settings.
 */
import { unstable_cache } from 'next/cache';
import { getAdminDb } from './firebase-admin';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from './utils';

export interface StoreSettings {
  /** When false, Cash on Delivery is hidden at checkout and rejected by the orders API. */
  codEnabled: boolean;
  /** Orders at or above this subtotal (INR) ship free. */
  freeShippingThreshold: number;
  /** Flat delivery charge (INR) for orders below the free-shipping threshold. */
  shippingFee: number;
  /** Return window in days for each product category. The "default" key applies to all products. */
  returnWindowByCategory: Record<string, number>;
  /** Social media profile URLs shown in the footer. Empty string = hidden. */
  socialLinks: SocialLinks;
  /**
   * What a supplier product's stock becomes when no stock can be found for it
   * (no stock column detected and no matching inventory row).
   * 'sold_out' = stock 0 (safe default), 'unlimited' = purchasable.
   */
  stockNotFoundBehaviour: StockNotFoundBehaviour;
  /** Items in the homepage "brand promise" strip (icon + title + description). */
  brandPromise: BrandPromiseItem[];
  /** Warehouse pincode used as the pickup point for courier serviceability checks. */
  pickupPincode: string;
  /** How often the auto price sync runs (hours). 0 = disabled. Default: 6. */
  priceSyncIntervalHours: number;
  /** ISO timestamp of the last successful auto price sync. */
  lastPriceSyncAt: string;
  /**
   * Where product images live. 'link' = keep the supplier URLs as-is (default);
   * 'firebase' = mirror images into Firebase Storage (needs FIREBASE_STORAGE_BUCKET).
   */
  imageStorageMode: ImageStorageMode;
}

export type ImageStorageMode = 'link' | 'firebase';

export function isValidImageStorageMode(value: unknown): value is ImageStorageMode {
  return value === 'link' || value === 'firebase';
}

/** Longest auto price sync interval the admin can set (hours) — 1 week. */
export const MAX_PRICE_SYNC_INTERVAL_HOURS = 168;

/** True for a whole number of hours 0..MAX_PRICE_SYNC_INTERVAL_HOURS (0 = auto sync disabled). */
export function isValidPriceSyncInterval(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICE_SYNC_INTERVAL_HOURS
  );
}

/** Default warehouse pickup pincode (Surat). */
export const DEFAULT_PICKUP_PINCODE = '395011';

/** True for exactly 6 digits. */
export function isValidPickupPincode(v: unknown): v is string {
  return typeof v === 'string' && /^\d{6}$/.test(v);
}

export type BrandPromiseIcon =
  | 'truck'
  | 'return'
  | 'chat'
  | 'shield'
  | 'star'
  | 'heart'
  | 'clock'
  | 'check'
  | 'gift'
  | 'lock'
  | 'tag'
  | 'bolt';

export interface BrandPromiseItem {
  icon: BrandPromiseIcon;
  title: string;
  description: string;
}

export const BRAND_PROMISE_ICONS: BrandPromiseIcon[] = [
  'truck', 'return', 'chat', 'shield', 'star', 'heart', 'clock', 'check', 'gift', 'lock', 'tag', 'bolt',
];

export const MAX_BRAND_PROMISE_TITLE_LENGTH = 60;
export const MAX_BRAND_PROMISE_DESCRIPTION_LENGTH = 200;
export const MAX_BRAND_PROMISE_ITEMS = 6;
export const MIN_BRAND_PROMISE_ITEMS = 1;

export const DEFAULT_BRAND_PROMISE: BrandPromiseItem[] = [
  { icon: 'truck', title: 'Free Shipping', description: 'On all orders over ₹999, delivered across India.' },
  { icon: 'return', title: '7-Day Returns', description: 'Not the right fit? Return or exchange within seven days.' },
  { icon: 'chat', title: 'WhatsApp Support', description: 'Real people, quick answers on sizing, orders and more.' },
];

/** True for 1..MAX_BRAND_PROMISE_ITEMS items, each with a known icon, a non-empty title and a description within limits. */
export function isValidBrandPromise(value: unknown): value is BrandPromiseItem[] {
  if (!Array.isArray(value)) return false;
  if (value.length < MIN_BRAND_PROMISE_ITEMS || value.length > MAX_BRAND_PROMISE_ITEMS) return false;
  return value.every((raw) => {
    if (typeof raw !== 'object' || raw === null) return false;
    const item = raw as Record<string, unknown>;
    return (
      BRAND_PROMISE_ICONS.includes(item.icon as BrandPromiseIcon) &&
      typeof item.title === 'string' &&
      item.title.trim().length > 0 &&
      item.title.length <= MAX_BRAND_PROMISE_TITLE_LENGTH &&
      typeof item.description === 'string' &&
      item.description.length <= MAX_BRAND_PROMISE_DESCRIPTION_LENGTH
    );
  });
}

export type StockNotFoundBehaviour = 'sold_out' | 'unlimited';

export function isValidStockNotFoundBehaviour(value: unknown): value is StockNotFoundBehaviour {
  return value === 'sold_out' || value === 'unlimited';
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
  shippingFee: SHIPPING_FEE,
  returnWindowByCategory: { default: DEFAULT_RETURN_WINDOW_DAYS },
  socialLinks: DEFAULT_SOCIAL_LINKS,
  stockNotFoundBehaviour: 'sold_out',
  brandPromise: DEFAULT_BRAND_PROMISE,
  pickupPincode: DEFAULT_PICKUP_PINCODE,
  priceSyncIntervalHours: 6,
  lastPriceSyncAt: '',
  imageStorageMode: 'link',
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

/** Highest flat shipping fee the admin can set (INR). */
export const MAX_SHIPPING_FEE = 2000;

/** True for a whole-rupee amount between 0 and MAX_SHIPPING_FEE. */
export function isValidShippingFee(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SHIPPING_FEE;
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
    shippingFee: isValidShippingFee(data?.shippingFee) ? data.shippingFee : DEFAULT_SETTINGS.shippingFee,
    // Merge with the default so the "default" key always exists (older docs lack this field).
    returnWindowByCategory: {
      ...DEFAULT_SETTINGS.returnWindowByCategory,
      ...(isValidReturnWindowByCategory(data?.returnWindowByCategory) ? data.returnWindowByCategory : {}),
    },
    // Merge with empty defaults so every platform key always exists.
    socialLinks: cleanSocialLinks(data?.socialLinks),
    stockNotFoundBehaviour: isValidStockNotFoundBehaviour(data?.stockNotFoundBehaviour)
      ? data.stockNotFoundBehaviour
      : DEFAULT_SETTINGS.stockNotFoundBehaviour,
    brandPromise: isValidBrandPromise(data?.brandPromise) ? data.brandPromise : DEFAULT_SETTINGS.brandPromise,
    pickupPincode: isValidPickupPincode(data?.pickupPincode) ? data.pickupPincode : DEFAULT_SETTINGS.pickupPincode,
    priceSyncIntervalHours:
      typeof data?.priceSyncIntervalHours === 'number' && data.priceSyncIntervalHours >= 0
        ? Math.min(Math.floor(data.priceSyncIntervalHours), MAX_PRICE_SYNC_INTERVAL_HOURS)
        : DEFAULT_SETTINGS.priceSyncIntervalHours,
    lastPriceSyncAt: typeof data?.lastPriceSyncAt === 'string' ? data.lastPriceSyncAt : '',
    imageStorageMode: isValidImageStorageMode(data?.imageStorageMode)
      ? data.imageStorageMode
      : DEFAULT_SETTINGS.imageStorageMode,
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

/**
 * Flat shipping fee for server-rendered pages (e.g. shipping policy). Cached for 60 seconds
 * and refreshed when the admin saves; falls back to the default if Firestore is unavailable.
 */
export const getShippingFee = unstable_cache(
  async (): Promise<number> => {
    try {
      return (await getStoreSettings()).shippingFee;
    } catch (error) {
      console.error('[settings] Could not read shipping fee; using default:', error);
      return DEFAULT_SETTINGS.shippingFee;
    }
  },
  ['shipping-fee'],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

/**
 * Stock fallback for supplier products (used by lib/sheets.ts). Cached for 60 seconds
 * and refreshed when the admin saves; falls back to 'sold_out' if Firestore is unavailable.
 */
export const getStockNotFoundBehaviour = unstable_cache(
  async (): Promise<StockNotFoundBehaviour> => {
    try {
      return (await getStoreSettings()).stockNotFoundBehaviour;
    } catch (error) {
      console.error('[settings] Could not read stock-not-found behaviour; using default:', error);
      return DEFAULT_SETTINGS.stockNotFoundBehaviour;
    }
  },
  ['stock-not-found-behaviour'],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

/**
 * Homepage brand-promise items. Cached for 60 seconds and refreshed when the admin saves;
 * falls back to the defaults if Firestore is unavailable.
 */
export const getBrandPromise = unstable_cache(
  async (): Promise<BrandPromiseItem[]> => {
    try {
      return (await getStoreSettings()).brandPromise;
    } catch (error) {
      console.error('[settings] Could not read brand promise; using default:', error);
      return DEFAULT_BRAND_PROMISE;
    }
  },
  ['brand-promise'],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

/**
 * Warehouse pickup pincode for courier serviceability checks (used by lib/pincode.ts).
 * Cached for 60 seconds and refreshed when the admin saves; falls back to the default
 * if Firestore is unavailable.
 */
export const getPickupPincode = unstable_cache(
  async (): Promise<string> => {
    try {
      return (await getStoreSettings()).pickupPincode;
    } catch (error) {
      console.error('[settings] Could not read pickup pincode; using default:', error);
      return DEFAULT_PICKUP_PINCODE;
    }
  },
  ['pickup-pincode'],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);
