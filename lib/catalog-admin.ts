/**
 * Catalog admin library — Firestore CRUD for ProductFamily, ProductListing, ProductSku.
 * Server-only. Uses firebase-admin.
 *
 * Collections:
 *   productFamilies/{familyId}
 *   productListings/{listingId}
 *   productSkus/{skuId}
 */
import type { Query } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import type {
  AdminListingDetail,
  ProductFamily,
  ProductFamilyInput,
  ProductFamilyUpdate,
  ProductListing,
  ProductListingInput,
  ProductListingUpdate,
  ProductSku,
  ProductSkuInput,
  ProductSkuUpdate,
} from './types';

export const FAMILIES_COLLECTION = 'productFamilies';
export const LISTINGS_COLLECTION = 'productListings';
export const SKUS_COLLECTION = 'productSkus';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function nowIso(): string {
  return new Date().toISOString();
}

function familyFromDoc(id: string, data: Record<string, unknown>): ProductFamily {
  return {
    id,
    familySku: typeof data.familySku === 'string' ? data.familySku : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function listingFromDoc(id: string, data: Record<string, unknown>): ProductListing {
  const status = data.status === 'draft' || data.status === 'archived' ? data.status : 'active';
  return {
    id,
    familyId: typeof data.familyId === 'string' ? data.familyId : '',
    listingSku: typeof data.listingSku === 'string' ? data.listingSku : '',
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    brand: typeof data.brand === 'string' ? data.brand : '',
    category: typeof data.category === 'string' ? data.category : '',
    color: typeof data.color === 'string' ? data.color : '',
    colorCode: typeof data.colorCode === 'string' ? data.colorCode : '',
    images: Array.isArray(data.images) ? (data.images as unknown[]).filter((u): u is string => typeof u === 'string') : [],
    coverImage: typeof data.coverImage === 'string' ? data.coverImage : '',
    status,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function skuFromDoc(id: string, data: Record<string, unknown>): ProductSku {
  const status = data.status === 'draft' || data.status === 'archived' ? data.status : 'active';
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    id,
    listingId: typeof data.listingId === 'string' ? data.listingId : '',
    sku: typeof data.sku === 'string' ? data.sku : '',
    size: typeof data.size === 'string' ? data.size : '',
    supplierPrice: n(data.supplierPrice),
    markup: n(data.markup),
    mrp: n(data.mrp),
    sellingPrice: n(data.sellingPrice),
    stockQuantity: n(data.stockQuantity),
    barcode: typeof data.barcode === 'string' ? data.barcode : '',
    status,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/* ------------------------------------------------------------------ */
/* ProductFamily                                                       */
/* ------------------------------------------------------------------ */

export async function getFamilies(): Promise<ProductFamily[]> {
  const snap = await getAdminDb().collection(FAMILIES_COLLECTION).orderBy('familySku').get();
  return snap.docs.map((d) => familyFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getFamily(id: string): Promise<ProductFamily | null> {
  const snap = await getAdminDb().collection(FAMILIES_COLLECTION).doc(id).get();
  return snap.exists ? familyFromDoc(snap.id, snap.data() as Record<string, unknown>) : null;
}

export async function createFamily(input: ProductFamilyInput): Promise<ProductFamily> {
  const now = nowIso();
  const ref = getAdminDb().collection(FAMILIES_COLLECTION).doc();
  const record = { familySku: input.familySku.trim(), createdAt: now, updatedAt: now };
  await ref.set(record);
  return { id: ref.id, ...record };
}

export async function updateFamily(id: string, update: ProductFamilyUpdate): Promise<ProductFamily> {
  const ref = getAdminDb().collection(FAMILIES_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`Family ${id} not found.`);
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (typeof update.familySku === 'string') patch.familySku = update.familySku.trim();
  await ref.update(patch);
  return familyFromDoc(id, { ...(existing.data() as Record<string, unknown>), ...patch });
}

export async function deleteFamily(id: string): Promise<void> {
  const ref = getAdminDb().collection(FAMILIES_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`Family ${id} not found.`);
  await ref.delete();
}

/* ------------------------------------------------------------------ */
/* ProductListing                                                      */
/* ------------------------------------------------------------------ */

export async function getListings(familyId?: string): Promise<ProductListing[]> {
  let query: Query = getAdminDb().collection(LISTINGS_COLLECTION);
  if (familyId) query = query.where('familyId', '==', familyId);
  const snap = await query.orderBy('listingSku').get();
  return snap.docs.map((d) => listingFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getListing(id: string): Promise<ProductListing | null> {
  const snap = await getAdminDb().collection(LISTINGS_COLLECTION).doc(id).get();
  return snap.exists ? listingFromDoc(snap.id, snap.data() as Record<string, unknown>) : null;
}

export async function createListing(input: ProductListingInput): Promise<ProductListing> {
  const now = nowIso();
  const ref = getAdminDb().collection(LISTINGS_COLLECTION).doc();
  const record: Omit<ProductListing, 'id'> = {
    familyId: input.familyId,
    listingSku: input.listingSku.trim(),
    title: input.title.trim(),
    description: input.description ?? '',
    brand: input.brand ?? '',
    category: input.category ?? '',
    color: input.color ?? '',
    colorCode: input.colorCode ?? '',
    images: Array.isArray(input.images) ? input.images : [],
    coverImage: input.coverImage ?? '',
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return { id: ref.id, ...record };
}

export async function updateListing(id: string, update: ProductListingUpdate): Promise<ProductListing> {
  const ref = getAdminDb().collection(LISTINGS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`Listing ${id} not found.`);
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  const textFields = ['listingSku', 'title', 'description', 'brand', 'category', 'color', 'colorCode', 'coverImage', 'status'] as const;
  for (const f of textFields) {
    const v = update[f];
    if (v !== undefined) patch[f] = typeof v === 'string' ? v.trim() : v;
  }
  if (Array.isArray(update.images)) patch.images = update.images;
  if (typeof update.familyId === 'string') patch.familyId = update.familyId;
  await ref.update(patch);
  return listingFromDoc(id, { ...(existing.data() as Record<string, unknown>), ...patch });
}

export async function deleteListing(id: string): Promise<void> {
  const ref = getAdminDb().collection(LISTINGS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`Listing ${id} not found.`);
  await ref.delete();
}

/* ------------------------------------------------------------------ */
/* ProductSku                                                          */
/* ------------------------------------------------------------------ */

export async function getSkus(listingId: string): Promise<ProductSku[]> {
  const snap = await getAdminDb()
    .collection(SKUS_COLLECTION)
    .where('listingId', '==', listingId)
    .orderBy('size')
    .get();
  return snap.docs.map((d) => skuFromDoc(d.id, d.data() as Record<string, unknown>));
}

/** Every SKU across all listings (used by the sheet sync to build its lookup map). */
export async function getAllSkus(): Promise<ProductSku[]> {
  const snap = await getAdminDb().collection(SKUS_COLLECTION).get();
  return snap.docs.map((d) => skuFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getSku(id: string): Promise<ProductSku | null> {
  const snap = await getAdminDb().collection(SKUS_COLLECTION).doc(id).get();
  return snap.exists ? skuFromDoc(snap.id, snap.data() as Record<string, unknown>) : null;
}

export async function createSku(input: ProductSkuInput): Promise<ProductSku> {
  const now = nowIso();
  const ref = getAdminDb().collection(SKUS_COLLECTION).doc();
  const record: Omit<ProductSku, 'id'> = {
    listingId: input.listingId,
    sku: input.sku.trim(),
    size: input.size.trim(),
    supplierPrice: input.supplierPrice ?? 0,
    markup: input.markup ?? 0,
    mrp: input.mrp ?? 0,
    sellingPrice: input.sellingPrice ?? (input.supplierPrice ?? 0) + (input.markup ?? 0),
    stockQuantity: input.stockQuantity ?? 0,
    barcode: input.barcode ?? '',
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return { id: ref.id, ...record };
}

export async function updateSku(id: string, update: ProductSkuUpdate): Promise<ProductSku> {
  const ref = getAdminDb().collection(SKUS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`SKU ${id} not found.`);
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  const textFields = ['sku', 'size', 'barcode', 'status'] as const;
  const numFields = ['supplierPrice', 'markup', 'mrp', 'sellingPrice', 'stockQuantity'] as const;
  for (const f of textFields) {
    const v = update[f];
    if (typeof v === 'string') patch[f] = v.trim();
  }
  for (const f of numFields) {
    const v = update[f];
    if (typeof v === 'number') patch[f] = v;
  }
  if (typeof update.listingId === 'string') patch.listingId = update.listingId;
  await ref.update(patch);
  return skuFromDoc(id, { ...(existing.data() as Record<string, unknown>), ...patch });
}

export async function deleteSku(id: string): Promise<void> {
  const ref = getAdminDb().collection(SKUS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`SKU ${id} not found.`);
  await ref.delete();
}

/* ------------------------------------------------------------------ */
/* Composite reads                                                     */
/* ------------------------------------------------------------------ */

/** Full detail for admin: listing + its family + sibling listings + its SKUs. */
export async function getAdminListingDetail(listingId: string): Promise<AdminListingDetail | null> {
  const listing = await getListing(listingId);
  if (!listing) return null;
  const [family, skus, siblings] = await Promise.all([
    getFamily(listing.familyId),
    getSkus(listingId),
    getListings(listing.familyId),
  ]);
  if (!family) return null;
  return {
    listing,
    family,
    siblings: siblings.filter((s) => s.id !== listingId),
    skus,
  };
}

/**
 * Batch-delete all SKUs belonging to a listing.
 * Use before deleting the listing itself.
 */
export async function deleteSkusForListing(listingId: string): Promise<number> {
  const skus = await getSkus(listingId);
  if (skus.length === 0) return 0;
  const db = getAdminDb();
  const BATCH_SIZE = 400;
  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const sku of skus.slice(i, i + BATCH_SIZE)) {
      batch.delete(db.collection(SKUS_COLLECTION).doc(sku.id));
    }
    await batch.commit();
  }
  return skus.length;
}

/**
 * Batch-delete all listings (and their SKUs) belonging to a family.
 * Use before deleting the family itself.
 */
export async function deleteListingsForFamily(familyId: string): Promise<{ listings: number; skus: number }> {
  const listings = await getListings(familyId);
  let totalSkus = 0;
  for (const listing of listings) {
    totalSkus += await deleteSkusForListing(listing.id);
  }
  const db = getAdminDb();
  const BATCH_SIZE = 400;
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const listing of listings.slice(i, i + BATCH_SIZE)) {
      batch.delete(db.collection(LISTINGS_COLLECTION).doc(listing.id));
    }
    await batch.commit();
  }
  return { listings: listings.length, skus: totalSkus };
}
