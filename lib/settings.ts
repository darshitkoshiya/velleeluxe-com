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
}

/** Used when the settings document has not been created yet. */
export const DEFAULT_SETTINGS: StoreSettings = {
  codEnabled: true,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
};

/** Highest threshold the admin can set (INR) — guards against typos like 99999999. */
export const MAX_FREE_SHIPPING_THRESHOLD = 100000;

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
  };
}

export async function updateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  await settingsRef().set({ ...updates, updatedAt: new Date().toISOString() }, { merge: true });
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
