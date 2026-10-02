/**
 * Server-side input validation for the catalog admin API routes
 * (app/api/admin/catalog/*). Each validator returns either the cleaned
 * value or throws a ValidationError with a user-facing message.
 */
import type { ProductSku } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type CatalogStatus = 'active' | 'draft' | 'archived';
const STATUSES: CatalogStatus[] = ['active', 'draft', 'archived'];

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Required trimmed string between min and max chars. */
export function reqString(body: Record<string, unknown>, field: string, min: number, max: number): string {
  const v = body[field];
  if (typeof v !== 'string') throw new ValidationError(`${field} is required and must be a string.`);
  const t = v.trim();
  if (t.length < min || t.length > max) {
    throw new ValidationError(`${field} must be ${min}–${max} characters.`);
  }
  return t;
}

/** Optional trimmed string up to max chars. Returns undefined when absent. */
export function optString(body: Record<string, unknown>, field: string, max: number): string | undefined {
  const v = body[field];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ValidationError(`${field} must be a string.`);
  const t = v.trim();
  if (t.length > max) throw new ValidationError(`${field} must be at most ${max} characters.`);
  return t;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function optStatus(body: Record<string, unknown>): CatalogStatus | undefined {
  const v = body.status;
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !STATUSES.includes(v as CatalogStatus)) {
    throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}.`);
  }
  return v as CatalogStatus;
}

function optImages(body: Record<string, unknown>): string[] | undefined {
  const v = body.images;
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new ValidationError('images must be an array of URLs.');
  return v.map((u, i) => {
    if (typeof u !== 'string' || !isHttpUrl(u.trim())) {
      throw new ValidationError(`images[${i}] must be a valid http/https URL.`);
    }
    return u.trim();
  });
}

function optCoverImage(body: Record<string, unknown>): string | undefined {
  const v = body.coverImage;
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ValidationError('coverImage must be a string.');
  const t = v.trim();
  if (t !== '' && !isHttpUrl(t)) throw new ValidationError('coverImage must be a valid http/https URL or empty.');
  return t;
}

/* ------------------------------------------------------------------ */
/* Family                                                              */
/* ------------------------------------------------------------------ */

export function validateFamilySku(body: Record<string, unknown>): string {
  return reqString(body, 'familySku', 1, 100);
}

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

export interface ListingFields {
  listingSku?: string;
  title?: string;
  description?: string;
  brand?: string;
  category?: string;
  color?: string;
  colorCode?: string;
  images?: string[];
  coverImage?: string;
  status?: CatalogStatus;
}

/**
 * Validates listing fields. When `partial` is false, listingSku and title are required.
 * familyId is never read here — callers handle it.
 */
export function validateListingFields(body: Record<string, unknown>, partial: boolean): ListingFields {
  const out: ListingFields = {};
  if (!partial || body.listingSku !== undefined) out.listingSku = reqString(body, 'listingSku', 1, 100);
  if (!partial || body.title !== undefined) out.title = reqString(body, 'title', 1, 200);
  out.description = optString(body, 'description', 5000);
  out.brand = optString(body, 'brand', 200);
  out.category = optString(body, 'category', 200);
  out.color = optString(body, 'color', 100);
  out.colorCode = optString(body, 'colorCode', 20);
  out.images = optImages(body);
  out.coverImage = optCoverImage(body);
  out.status = optStatus(body);
  // Drop undefined keys so partial updates only touch provided fields.
  for (const k of Object.keys(out) as (keyof ListingFields)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* SKU                                                                 */
/* ------------------------------------------------------------------ */

function num(
  body: Record<string, unknown>,
  field: string,
  opts: { required: boolean; integer?: boolean; max?: number },
): number | undefined {
  const v = body[field];
  if (v === undefined) {
    if (opts.required) throw new ValidationError(`${field} is required.`);
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${field} must be a finite number.`);
  if (v < 0) throw new ValidationError(`${field} must be 0 or more.`);
  if (opts.integer && !Number.isInteger(v)) throw new ValidationError(`${field} must be a whole number.`);
  if (opts.max !== undefined && v > opts.max) throw new ValidationError(`${field} must be at most ${opts.max}.`);
  return v;
}

export type SkuFields = Partial<
  Pick<ProductSku, 'sku' | 'size' | 'supplierPrice' | 'markup' | 'mrp' | 'sellingPrice' | 'stockQuantity' | 'barcode' | 'status'>
>;

/**
 * Validates SKU fields. When `partial` is false, sku/size/supplierPrice/markup/mrp are required.
 * sellingPrice is validated but the caller decides whether to honour or recompute it.
 */
export function validateSkuFields(body: Record<string, unknown>, partial: boolean): SkuFields {
  const req = !partial;
  const out: SkuFields = {};
  if (req || body.sku !== undefined) out.sku = reqString(body, 'sku', 1, 100);
  if (req || body.size !== undefined) out.size = reqString(body, 'size', 1, 20);
  out.supplierPrice = num(body, 'supplierPrice', { required: req });
  out.markup = num(body, 'markup', { required: req, integer: true, max: 1_000_000 });
  out.mrp = num(body, 'mrp', { required: req });
  out.sellingPrice = num(body, 'sellingPrice', { required: false });
  out.stockQuantity = num(body, 'stockQuantity', { required: false, integer: true });
  out.barcode = optString(body, 'barcode', 100);
  out.status = optStatus(body);
  for (const k of Object.keys(out) as (keyof SkuFields)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

/** Parses the JSON body; throws ValidationError if missing/invalid/not an object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
  if (!isPlainObject(body)) throw new ValidationError('Request body must be a JSON object.');
  return body;
}

/** Shared error-to-response helper for catalog routes. */
export function errorResponse(err: unknown, fallback: string): Response {
  if (err instanceof ValidationError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  console.error(fallback, err);
  const message = err instanceof Error && err.message ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
