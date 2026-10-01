/**
 * Admin product management (server-only).
 *
 * - productOverrides/{productId}: price/title/description/featured/hidden edits for sheet products
 * - manualProducts/{slug}: one-off products added in the admin panel (not tied to a supplier sheet)
 *
 * Reads are cached for 60 seconds under PRODUCT_OVERRIDES_CACHE_TAG; the admin API
 * revalidates that tag after every write.
 */
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import type { AdminProduct, ManualProduct, Product, ProductOverride } from './types';

export const PRODUCT_OVERRIDES_COLLECTION = 'productOverrides';
export const MANUAL_PRODUCTS_COLLECTION = 'manualProducts';
export const PRODUCT_OVERRIDES_CACHE_TAG = 'product-overrides';

/** Prefix for manual product IDs, so they can never clash with sheet product IDs. */
export const MANUAL_ID_PREFIX = 'manual-';

/** Fields of an override that can be set, or cleared by passing null. */
export type OverrideUpdate = {
  priceOverride?: number | null;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  featured?: boolean | null;
  hidden?: boolean | null;
};

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

async function fetchOverrides(): Promise<ProductOverride[]> {
  const snapshot = await getAdminDb().collection(PRODUCT_OVERRIDES_COLLECTION).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as ProductOverride), productId: doc.id }));
}

async function fetchManualProducts(): Promise<ManualProduct[]> {
  const snapshot = await getAdminDb().collection(MANUAL_PRODUCTS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ ...(doc.data() as ManualProduct), slug: doc.id }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

const fetchOverridesCached = unstable_cache(fetchOverrides, ['vl-product-overrides'], {
  revalidate: 60,
  tags: [PRODUCT_OVERRIDES_CACHE_TAG],
});

const fetchManualProductsCached = unstable_cache(fetchManualProducts, ['vl-manual-products'], {
  revalidate: 60,
  tags: [PRODUCT_OVERRIDES_CACHE_TAG],
});

export async function getProductOverrides(): Promise<Map<string, ProductOverride>> {
  const overrides = await fetchOverridesCached();
  return new Map(overrides.map((override) => [override.productId, override]));
}

export async function getManualProducts(): Promise<ManualProduct[]> {
  return fetchManualProductsCached();
}

/** Uncached single read, used by the admin API before writing. */
export async function getManualProduct(slug: string): Promise<ManualProduct | null> {
  const snapshot = await getAdminDb().collection(MANUAL_PRODUCTS_COLLECTION).doc(slug).get();
  return snapshot.exists ? { ...(snapshot.data() as ManualProduct), slug: snapshot.id } : null;
}

/** Uncached single read, used by the admin API before deleting. */
export async function getProductOverride(productId: string): Promise<ProductOverride | null> {
  const snapshot = await getAdminDb().collection(PRODUCT_OVERRIDES_COLLECTION).doc(productId).get();
  return snapshot.exists ? { ...(snapshot.data() as ProductOverride), productId: snapshot.id } : null;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/** Upserts an override (merge). Fields passed as null are removed from the document. */
export async function setProductOverride(productId: string, override: OverrideUpdate): Promise<void> {
  const payload: Record<string, unknown> = { productId, updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    payload[key] = value === null ? FieldValue.delete() : value;
  }
  await getAdminDb().collection(PRODUCT_OVERRIDES_COLLECTION).doc(productId).set(payload, { merge: true });
}

export async function deleteProductOverride(productId: string): Promise<void> {
  await getAdminDb().collection(PRODUCT_OVERRIDES_COLLECTION).doc(productId).delete();
}

export async function setManualProduct(product: ManualProduct): Promise<void> {
  await getAdminDb().collection(MANUAL_PRODUCTS_COLLECTION).doc(product.slug).set(product);
}

export async function deleteManualProduct(slug: string): Promise<void> {
  await getAdminDb().collection(MANUAL_PRODUCTS_COLLECTION).doc(slug).delete();
}

/** Refreshes cached override reads and every storefront page that shows products. Call after writes. */
export function revalidateProductData(): void {
  revalidateTag(PRODUCT_OVERRIDES_CACHE_TAG);
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------ */
/* Merging                                                             */
/* ------------------------------------------------------------------ */

/** Applies one override's field changes to a product (does not filter hidden). */
export function mergeOverride(product: Product, override: ProductOverride | undefined): Product {
  if (!override) return product;
  return {
    ...product,
    name: override.titleOverride?.trim() ? override.titleOverride : product.name,
    description: override.descriptionOverride?.trim() ? override.descriptionOverride : product.description,
    price:
      typeof override.priceOverride === 'number' && override.priceOverride > 0 ? override.priceOverride : product.price,
    featured: override.featured === true,
  };
}

/** Drops hidden products and applies field overrides to the rest. */
export function applyOverrides(products: Product[], overrides: Map<string, ProductOverride>): Product[] {
  return products
    .filter((product) => overrides.get(product.id)?.hidden !== true)
    .map((product) => mergeOverride(product, overrides.get(product.id)));
}

/** Converts a manual product to the storefront Product shape. */
export function manualToProduct(manual: ManualProduct): Product {
  return {
    id: manual.id || `${MANUAL_ID_PREFIX}${manual.slug}`,
    slug: manual.slug,
    name: manual.name,
    description: manual.description,
    price: manual.price,
    sizes: manual.sizes ?? [],
    style: manual.fabric ?? '',
    colour: manual.colour ?? '',
    fit: '',
    driveFolderId: '',
    images: manual.images ?? [],
    careInstructions: '',
    seoTitle: manual.name,
    seoDescription: manual.description.slice(0, 160),
    status: 'live',
    stock: typeof manual.stock === 'number' ? manual.stock : 0,
    createdAt: manual.createdAt,
    updatedAt: manual.updatedAt,
    featured: manual.featured === true,
    source: 'manual',
  };
}

/** Non-hidden manual products in storefront shape. */
export function visibleManualProducts(manual: ManualProduct[]): Product[] {
  return manual.filter((product) => product.hidden !== true).map(manualToProduct);
}

/** Every product for the admin list: overrides applied, hidden ones kept and flagged. */
export function buildAdminProducts(
  sheetProducts: Product[],
  overrides: Map<string, ProductOverride>,
  manual: ManualProduct[],
): AdminProduct[] {
  const fromSheet: AdminProduct[] = sheetProducts.map((product) => {
    const override = overrides.get(product.id);
    return {
      ...mergeOverride(product, override),
      source: 'sheet',
      featured: override?.featured === true,
      hidden: override?.hidden === true,
      original: { name: product.name, description: product.description, price: product.price },
      override,
    };
  });
  const fromManual: AdminProduct[] = manual.map((product) => ({
    ...manualToProduct(product),
    source: 'manual',
    featured: product.featured === true,
    hidden: product.hidden === true,
  }));
  return [...fromManual, ...fromSheet];
}

/** Lowercase kebab-case slug from a product name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
