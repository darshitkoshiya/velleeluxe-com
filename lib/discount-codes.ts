/**
 * Discount codes (server-only — uses the Firebase Admin SDK).
 *
 * Firestore: discountCodes/{CODE}, where the document ID is the uppercase code.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import type { DiscountCode } from './types';

const COLLECTION = 'discountCodes';

/** Codes are 3–20 letters/digits. Checked before any Firestore read. */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9]{3,20}$/;

export const MAX_DISCOUNT_FIXED_VALUE = 100000;

export class DiscountCodeNotFoundError extends Error {}
export class DiscountCodeExistsError extends Error {}

/** Trims and uppercases; returns '' if the result isn't a valid code format. */
export function normaliseDiscountCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  const code = value.trim().toUpperCase();
  return DISCOUNT_CODE_PATTERN.test(code) ? code : '';
}

function codesCollection() {
  return getAdminDb().collection(COLLECTION);
}

export async function getDiscountCode(code: string): Promise<DiscountCode | null> {
  const normalised = normaliseDiscountCode(code);
  if (!normalised) return null;
  const snapshot = await codesCollection().doc(normalised).get();
  return snapshot.exists ? (snapshot.data() as DiscountCode) : null;
}

/** Discount in whole rupees, never more than the subtotal. */
export function computeDiscountAmount(code: DiscountCode, subtotal: number): number {
  const raw = code.type === 'percent' ? Math.round((subtotal * code.value) / 100) : code.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export async function validateDiscountCode(
  code: string,
  subtotal: number,
): Promise<{ valid: true; code: DiscountCode; discountAmount: number } | { valid: false; error: string }> {
  const normalised = normaliseDiscountCode(code);
  if (!normalised) return { valid: false, error: 'This discount code is not valid.' };

  const discount = await getDiscountCode(normalised);
  if (!discount || discount.active !== true) {
    return { valid: false, error: 'This discount code is not valid.' };
  }
  if (discount.expiresAt) {
    const expires = Date.parse(discount.expiresAt);
    if (!Number.isNaN(expires) && Date.now() > expires) {
      return { valid: false, error: 'This discount code has expired.' };
    }
  }
  if (typeof discount.maxUses === 'number' && (discount.usedCount ?? 0) >= discount.maxUses) {
    return { valid: false, error: 'This discount code has reached its usage limit.' };
  }
  if (typeof discount.minOrderAmount === 'number' && subtotal < discount.minOrderAmount) {
    return {
      valid: false,
      error: `This code needs a minimum order of ₹${discount.minOrderAmount.toLocaleString('en-IN')}.`,
    };
  }

  const discountAmount = computeDiscountAmount(discount, subtotal);
  if (discountAmount <= 0) return { valid: false, error: 'This discount code cannot be applied to your order.' };
  return { valid: true, code: discount, discountAmount };
}

export async function incrementDiscountUsage(code: string): Promise<void> {
  const normalised = normaliseDiscountCode(code);
  if (!normalised) return;
  await codesCollection()
    .doc(normalised)
    .update({ usedCount: FieldValue.increment(1) });
}

/** All codes, newest first. */
export async function listDiscountCodes(): Promise<DiscountCode[]> {
  const snapshot = await codesCollection().get();
  const codes = snapshot.docs.map((doc) => doc.data() as DiscountCode);
  return codes.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Creates a code; throws DiscountCodeExistsError if it already exists. */
export async function createDiscountCode(code: DiscountCode): Promise<void> {
  const ref = codesCollection().doc(code.code);
  try {
    await ref.create(code);
  } catch (error) {
    // gRPC code 6 = ALREADY_EXISTS
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 6) {
      throw new DiscountCodeExistsError(`Code ${code.code} already exists.`);
    }
    throw error;
  }
}

export async function updateDiscountCode(code: string, updates: Partial<DiscountCode>): Promise<void> {
  const ref = codesCollection().doc(code);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new DiscountCodeNotFoundError(`Code ${code} not found.`);
  // The code is the document ID and can't be renamed.
  const { code: _ignored, ...rest } = updates;
  void _ignored;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    // undefined / null clears an optional field.
    data[key] = value === undefined || value === null ? FieldValue.delete() : value;
  }
  if (Object.keys(data).length === 0) return;
  await ref.update(data);
}

export async function deleteDiscountCode(code: string): Promise<void> {
  const ref = codesCollection().doc(code);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new DiscountCodeNotFoundError(`Code ${code} not found.`);
  await ref.delete();
}

/* ------------------------------------------------------------------ */
/* Admin request parsing                                               */
/* ------------------------------------------------------------------ */

function optionalWholeNumber(value: unknown, min: number): number | undefined | 'invalid' {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) return 'invalid';
  return n;
}

function parseExpiry(value: unknown): string | undefined | 'invalid' {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return 'invalid';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'invalid';
  return new Date(parsed).toISOString();
}

/** Validates the admin "create code" body. */
export function parseNewDiscountCode(body: unknown): { data: DiscountCode } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request.' };
  const input = body as Record<string, unknown>;

  const code = normaliseDiscountCode(input.code);
  if (!code) return { error: 'Code must be 3–20 letters or numbers.' };

  const type = input.type;
  if (type !== 'percent' && type !== 'fixed') return { error: "Type must be 'percent' or 'fixed'." };

  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1) return { error: 'Value must be a whole number of at least 1.' };
  if (type === 'percent' && value > 100) return { error: 'Percent off cannot be more than 100.' };
  if (type === 'fixed' && value > MAX_DISCOUNT_FIXED_VALUE) return { error: 'Fixed discount is too large.' };

  const minOrderAmount = optionalWholeNumber(input.minOrderAmount, 0);
  if (minOrderAmount === 'invalid') return { error: 'Minimum order must be a whole number of rupees.' };

  const maxUses = optionalWholeNumber(input.maxUses, 1);
  if (maxUses === 'invalid') return { error: 'Max uses must be a whole number of at least 1.' };

  const expiresAt = parseExpiry(input.expiresAt);
  if (expiresAt === 'invalid') return { error: 'Expiry date is not valid.' };

  return {
    data: {
      code,
      type,
      value,
      minOrderAmount,
      maxUses,
      usedCount: 0,
      active: input.active === undefined ? true : input.active === true,
      expiresAt,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Validates the admin "update code" body. Only known, editable fields are kept. */
export function parseDiscountCodeUpdates(body: unknown): { data: Partial<DiscountCode> } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request.' };
  const input = body as Record<string, unknown>;
  const data: Partial<DiscountCode> = {};

  if ('active' in input) {
    if (typeof input.active !== 'boolean') return { error: 'active must be true or false.' };
    data.active = input.active;
  }
  if ('type' in input) {
    if (input.type !== 'percent' && input.type !== 'fixed') return { error: "Type must be 'percent' or 'fixed'." };
    data.type = input.type;
  }
  if ('value' in input) {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1) return { error: 'Value must be a whole number of at least 1.' };
    if (data.type === 'percent' && value > 100) return { error: 'Percent off cannot be more than 100.' };
    if (value > MAX_DISCOUNT_FIXED_VALUE) return { error: 'Discount value is too large.' };
    data.value = value;
  }
  if ('minOrderAmount' in input) {
    const min = optionalWholeNumber(input.minOrderAmount, 0);
    if (min === 'invalid') return { error: 'Minimum order must be a whole number of rupees.' };
    data.minOrderAmount = min;
  }
  if ('maxUses' in input) {
    const max = optionalWholeNumber(input.maxUses, 1);
    if (max === 'invalid') return { error: 'Max uses must be a whole number of at least 1.' };
    data.maxUses = max ?? null;
  }
  if ('expiresAt' in input) {
    const expiresAt = parseExpiry(input.expiresAt);
    if (expiresAt === 'invalid') return { error: 'Expiry date is not valid.' };
    data.expiresAt = expiresAt;
  }

  if (Object.keys(data).length === 0) return { error: 'Nothing to update.' };
  return { data };
}
