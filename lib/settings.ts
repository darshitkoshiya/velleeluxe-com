/**
 * Store-wide settings kept in Firestore at `config/settings` (server-only).
 * Changed from the admin panel at /admin/settings.
 */
import { getAdminDb } from './firebase-admin';

export interface StoreSettings {
  /** When false, Cash on Delivery is hidden at checkout and rejected by the orders API. */
  codEnabled: boolean;
}

/** Used when the settings document has not been created yet. */
export const DEFAULT_SETTINGS: StoreSettings = {
  codEnabled: true,
};

function settingsRef() {
  return getAdminDb().collection('config').doc('settings');
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const snapshot = await settingsRef().get();
  const data = snapshot.exists ? snapshot.data() : undefined;
  return {
    codEnabled: typeof data?.codEnabled === 'boolean' ? data.codEnabled : DEFAULT_SETTINGS.codEnabled,
  };
}

export async function updateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  await settingsRef().set({ ...updates, updatedAt: new Date().toISOString() }, { merge: true });
  return getStoreSettings();
}
