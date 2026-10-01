/**
 * Store credit ledger (server-only). Lives at users/{uid}/storeCredit/summary:
 *   { balance, transactions: [{ id, type: 'credit'|'debit', amount, reason, orderId?, returnId?, createdAt, createdBy }] }
 *
 * Only the server writes it (Firestore rules block customer writes). Every entry needs a reason,
 * and admin-initiated changes must pass the ADMIN_TPIN check first.
 */
import crypto from 'crypto';
import { FieldValue, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { STORE_CREDIT_COLLECTION, STORE_CREDIT_DOC } from './returns-shared';
import type { StoreCredit, StoreCreditEntryType, StoreCreditTransaction } from './types';

/** Largest single credit/debit the admin can enter (INR) — guards against typos. */
export const MAX_STORE_CREDIT_ENTRY = 100000;

export class StoreCreditError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function storeCreditRef(uid: string): DocumentReference {
  return getAdminDb().collection('users').doc(uid).collection(STORE_CREDIT_COLLECTION).doc(STORE_CREDIT_DOC);
}

function roundRupees(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function generateEntryId(): string {
  return `SC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Checks the admin TPIN against ADMIN_TPIN (constant-time).
 * Throws 401 "Incorrect TPIN" when wrong, 503 when ADMIN_TPIN is not configured.
 */
export function assertAdminTpin(tpin: unknown): void {
  const expected = process.env.ADMIN_TPIN;
  if (!expected) throw new StoreCreditError('ADMIN_TPIN is not configured on the server.', 503);
  const given = typeof tpin === 'string' ? tpin.trim() : '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!given || !crypto.timingSafeEqual(a, b)) throw new StoreCreditError('Incorrect TPIN', 401);
}

export interface StoreCreditEntryInput {
  type: StoreCreditEntryType;
  amount: number;
  reason: string;
  orderId?: string;
  returnId?: string;
  createdBy: 'system' | 'admin';
}

function validateEntry(input: StoreCreditEntryInput): StoreCreditEntryInput {
  const reason = (input.reason || '').trim().slice(0, 300);
  if (!reason) throw new StoreCreditError('A reason is required for every store credit entry.');
  if (input.type !== 'credit' && input.type !== 'debit') throw new StoreCreditError('Type must be credit or debit.');
  const amount = roundRupees(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_STORE_CREDIT_ENTRY) {
    throw new StoreCreditError(`Amount must be between 1 and ${MAX_STORE_CREDIT_ENTRY}.`);
  }
  return { ...input, reason, amount };
}

/**
 * Adds one ledger entry inside an existing Firestore transaction.
 * `snapshotData` must be read earlier in the same transaction (reads before writes).
 */
export function writeStoreCreditEntry(
  transaction: Transaction,
  ref: DocumentReference,
  snapshotData: Partial<StoreCredit> | undefined,
  input: StoreCreditEntryInput,
): { entry: StoreCreditTransaction; balance: number } {
  const clean = validateEntry(input);
  const current = typeof snapshotData?.balance === 'number' ? snapshotData.balance : 0;
  const balance = roundRupees(clean.type === 'credit' ? current + clean.amount : current - clean.amount);
  if (balance < 0) {
    throw new StoreCreditError(`Cannot deduct more than the available balance (${current}).`, 409);
  }
  const entry: StoreCreditTransaction = {
    id: generateEntryId(),
    type: clean.type,
    amount: clean.amount,
    reason: clean.reason,
    orderId: clean.orderId || undefined,
    returnId: clean.returnId || undefined,
    createdAt: new Date().toISOString(),
    createdBy: clean.createdBy,
  };
  // arrayUnion rejects undefined fields, so drop them.
  const stored = Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined));
  transaction.set(
    ref,
    { balance, transactions: FieldValue.arrayUnion(stored), updatedAt: entry.createdAt },
    { merge: true },
  );
  return { entry, balance };
}

/** Standalone credit/debit (admin manual adjustment). */
export async function adjustStoreCredit(uid: string, input: StoreCreditEntryInput): Promise<{ entry: StoreCreditTransaction; balance: number }> {
  const db = getAdminDb();
  const ref = storeCreditRef(uid);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    return writeStoreCreditEntry(transaction, ref, snapshot.exists ? (snapshot.data() as Partial<StoreCredit>) : undefined, input);
  });
}

export async function getStoreCredit(uid: string): Promise<StoreCredit> {
  const snapshot = await storeCreditRef(uid).get();
  const data = snapshot.exists ? (snapshot.data() as Partial<StoreCredit>) : undefined;
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  return {
    balance: typeof data?.balance === 'number' ? data.balance : 0,
    transactions: [...transactions].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    updatedAt: data?.updatedAt,
  };
}
