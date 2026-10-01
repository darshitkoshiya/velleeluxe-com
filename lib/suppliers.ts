/**
 * Suppliers — stored in the Firestore `suppliers` collection (server-only).
 * Each supplier points at the Google Sheet (spreadsheet + tab) that lists its products
 * and the Google Drive folder that holds its product images.
 */
import { getAdminDb } from '@/lib/firebase-admin';

export const SUPPLIERS_COLLECTION = 'suppliers';
export const DEFAULT_SHEET_TAB = 'Products';

export interface Supplier {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetTab: string;
  driveFolderId: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;
export type SupplierUpdate = Partial<Omit<Supplier, 'id' | 'createdAt'>>;

/** Thrown when a supplier id does not exist. */
export class SupplierNotFoundError extends Error {
  constructor(id: string) {
    super(`Supplier ${id} not found.`);
    this.name = 'SupplierNotFoundError';
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function fromDoc(id: string, data: Record<string, unknown> | undefined): Supplier {
  const d = data ?? {};
  return {
    id,
    name: str(d.name),
    spreadsheetId: str(d.spreadsheetId),
    sheetTab: str(d.sheetTab) || DEFAULT_SHEET_TAB,
    driveFolderId: str(d.driveFolderId),
    contactName: str(d.contactName),
    contactPhone: str(d.contactPhone),
    notes: str(d.notes),
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
  };
}

const TEXT_FIELDS = ['name', 'spreadsheetId', 'sheetTab', 'driveFolderId', 'contactName', 'contactPhone', 'notes'] as const;
const MAX_FIELD_LENGTH = 2000;

/**
 * Validates a request body. `partial` = PATCH (only the fields sent are checked).
 * Returns trimmed values, or an error message for the admin.
 */
export function parseSupplierBody(
  body: unknown,
  partial: boolean,
): { data: SupplierUpdate } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body.' };
  const input = body as Record<string, unknown>;
  const data: SupplierUpdate = {};

  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== 'string') return { error: `${field} must be text.` };
    if (value.length > MAX_FIELD_LENGTH) return { error: `${field} is too long.` };
    data[field] = value.trim();
  }

  if (!partial || data.name !== undefined) {
    if (!data.name) return { error: 'Supplier name is required.' };
  }
  if (!partial || data.spreadsheetId !== undefined) {
    if (!data.spreadsheetId) return { error: 'Spreadsheet ID is required.' };
  }
  if (partial && Object.keys(data).length === 0) return { error: 'Nothing to save.' };
  return { data };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const snapshot = await getAdminDb().collection(SUPPLIERS_COLLECTION).orderBy('name').get();
  return snapshot.docs.map((doc) => fromDoc(doc.id, doc.data()));
}

export async function createSupplier(data: SupplierInput): Promise<Supplier> {
  const now = new Date().toISOString();
  const ref = getAdminDb().collection(SUPPLIERS_COLLECTION).doc();
  const record = {
    name: data.name,
    spreadsheetId: data.spreadsheetId,
    sheetTab: data.sheetTab || DEFAULT_SHEET_TAB,
    driveFolderId: data.driveFolderId ?? '',
    contactName: data.contactName ?? '',
    contactPhone: data.contactPhone ?? '',
    notes: data.notes ?? '',
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return { id: ref.id, ...record };
}

export async function updateSupplier(id: string, data: SupplierUpdate): Promise<Supplier> {
  const ref = getAdminDb().collection(SUPPLIERS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new SupplierNotFoundError(id);

  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  for (const field of TEXT_FIELDS) {
    const value = data[field];
    if (typeof value === 'string') updates[field] = value;
  }
  if (updates.sheetTab === '') updates.sheetTab = DEFAULT_SHEET_TAB;

  await ref.update(updates);
  const saved = await ref.get();
  return fromDoc(saved.id, saved.data());
}

export async function deleteSupplier(id: string): Promise<void> {
  const ref = getAdminDb().collection(SUPPLIERS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new SupplierNotFoundError(id);
  await ref.delete();
}
