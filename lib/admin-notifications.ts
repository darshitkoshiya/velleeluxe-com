/**
 * Admin notifications — problems the site noticed on its own (server-only).
 * Stored in the Firestore `adminNotifications` collection and shown at /admin/notifications.
 *
 * The same problem (category + spreadsheet) always maps to the same document, so a
 * problem that repeats on every 60 s product refresh updates one alert instead of
 * creating hundreds. When the same thing later succeeds, resolveNotification() clears it.
 */
import { getAdminDb } from '@/lib/firebase-admin';

export const ADMIN_NOTIFICATIONS_COLLECTION = 'adminNotifications';

export type NotificationType = 'error' | 'warning' | 'info';
export type NotificationCategory =
  | 'schema_detection_failed' // Gemini couldn't map columns
  | 'stock_not_found' // no stock column in sheet or inventory
  | 'sheet_unreadable' // Sheets API error
  | 'supplier_empty' // supplier folder has no usable products
  | 'inventory_columns_missing'; // inventory sheet found but SKU/qty cols unidentified

export interface AdminNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  supplierName?: string;
  spreadsheetId?: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

const TYPES: readonly NotificationType[] = ['error', 'warning', 'info'];

/** Stable doc ID: base64url of `${category}::${spreadsheetId ?? ''}`. */
function notificationId(category: NotificationCategory, spreadsheetId?: string): string {
  return Buffer.from(`${category}::${spreadsheetId ?? ''}`).toString('base64url');
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function fromDoc(id: string, data: Record<string, unknown> | undefined): AdminNotification {
  const d = data ?? {};
  const type = TYPES.includes(d.type as NotificationType) ? (d.type as NotificationType) : 'info';
  return {
    id,
    type,
    category: str(d.category) as NotificationCategory,
    title: str(d.title),
    message: str(d.message),
    supplierName: str(d.supplierName) || undefined,
    spreadsheetId: str(d.spreadsheetId) || undefined,
    resolved: d.resolved === true,
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
  };
}

/**
 * Creates or updates the alert for this category + spreadsheet and marks it unresolved.
 * The original createdAt is kept when the alert already exists.
 */
export async function raiseNotification(
  n: Omit<AdminNotification, 'id' | 'createdAt' | 'updatedAt' | 'resolved'>,
): Promise<void> {
  const ref = getAdminDb().collection(ADMIN_NOTIFICATIONS_COLLECTION).doc(notificationId(n.category, n.spreadsheetId));
  const now = new Date().toISOString();
  const existing = await ref.get();
  const previous = existing.exists ? fromDoc(existing.id, existing.data()) : null;
  // A still-open alert keeps its createdAt; one that had been resolved starts over.
  const createdAt = previous && !previous.resolved && previous.createdAt ? previous.createdAt : now;
  await ref.set({
    type: n.type,
    category: n.category,
    title: n.title,
    message: n.message,
    supplierName: n.supplierName ?? '',
    spreadsheetId: n.spreadsheetId ?? '',
    resolved: false,
    createdAt,
    updatedAt: now,
  });
}

/** Marks the alert for this category + spreadsheet resolved. No-op if there is none open. */
export async function resolveNotification(category: NotificationCategory, spreadsheetId?: string): Promise<void> {
  const ref = getAdminDb().collection(ADMIN_NOTIFICATIONS_COLLECTION).doc(notificationId(category, spreadsheetId));
  const existing = await ref.get();
  if (!existing.exists || existing.data()?.resolved === true) return;
  await ref.update({ resolved: true, updatedAt: new Date().toISOString() });
}

/** All alerts (or only open ones), open first, then newest first. */
export async function getNotifications(onlyUnresolved = false): Promise<AdminNotification[]> {
  // Filtered and sorted in memory — the collection is small and this avoids a composite index.
  const snapshot = await getAdminDb().collection(ADMIN_NOTIFICATIONS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => fromDoc(doc.id, doc.data()))
    .filter((n) => !onlyUnresolved || !n.resolved)
    .sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
    });
}

/** Marks one alert resolved (the admin has seen it). */
export async function dismissNotification(id: string): Promise<void> {
  const ref = getAdminDb().collection(ADMIN_NOTIFICATIONS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return;
  await ref.update({ resolved: true, updatedAt: new Date().toISOString() });
}

/** Removes every resolved alert from the list. Returns how many were removed. */
export async function clearResolvedNotifications(): Promise<number> {
  const db = getAdminDb();
  const snapshot = await db.collection(ADMIN_NOTIFICATIONS_COLLECTION).where('resolved', '==', true).get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}
