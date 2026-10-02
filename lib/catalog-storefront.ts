/**
 * Storefront catalogue read from Firestore (productFamilies / productListings / productSkus).
 *
 * Converts each active ProductListing + its SKUs into the storefront Product shape,
 * then layers admin overrides and manual products on top. Server-only.
 */
import { getAllSkus, getListings } from './catalog-admin';
import { getManualProducts, getProductOverrides, manualToProduct, mergeOverride } from './product-overrides';
import type { ManualProduct, Product, ProductListing, ProductOverride, ProductSku } from './types';

/** URL slug from a listing SKU: lowercase, non-alphanumerics → hyphen, trimmed. */
export function listingSlug(listingSku: string): string {
  return listingSku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listingToProduct(listing: ProductListing, skus: ProductSku[]): Product {
  // Only active SKUs are purchasable: draft and archived SKUs are excluded from
  // prices, stock, and the size list shown to customers.
  const activeSkus = skus.filter((s) => s.status === 'active');
  const prices = activeSkus.map((s) => s.sellingPrice).filter((p) => p > 0);
  const mrps = activeSkus.map((s) => s.mrp).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const minMrp = mrps.length > 0 ? Math.min(...mrps) : 0;
  const totalStock = activeSkus.reduce((sum, s) => sum + (s.stockQuantity ?? 0), 0);

  const stockBySize: Record<string, number> = {};
  for (const sku of activeSkus) {
    if (sku.size) stockBySize[sku.size] = (stockBySize[sku.size] ?? 0) + (sku.stockQuantity ?? 0);
  }
  // Unique sizes, in SKU order.
  const sizes = Array.from(new Set(activeSkus.map((s) => s.size).filter(Boolean)));

  // Cover image first (if set and not already in the gallery), then the gallery.
  const gallery = listing.images ?? [];
  const images =
    listing.coverImage && !gallery.includes(listing.coverImage) ? [listing.coverImage, ...gallery] : gallery;

  const description = listing.description ?? '';
  const name = listing.title || listing.listingSku;

  return {
    id: listing.id,
    slug: listingSlug(listing.listingSku),
    name,
    description,
    price: minPrice,
    compareAtPrice: minMrp > minPrice ? minMrp : undefined,
    sizes,
    style: listing.brand ?? '',
    colour: listing.color ?? '',
    fit: '',
    driveFolderId: '',
    images,
    careInstructions: '',
    seoTitle: name,
    seoDescription: description.slice(0, 160),
    status: 'live', // only active listings are converted
    stock: totalStock,
    stockBySize: Object.keys(stockBySize).length > 0 ? stockBySize : undefined,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    designId: listing.familyId || undefined, // familyId links colour siblings
    featured: false,
    source: 'sheet',
    attributes: {
      category: listing.category ?? '',
      colorCode: listing.colorCode ?? '',
      listingSku: listing.listingSku,
    },
  };
}

/** Active Firestore listings in storefront shape (no overrides applied). */
export async function getCatalogProducts(): Promise<Product[]> {
  const [listings, allSkus] = await Promise.all([getListings(), getAllSkus()]);

  const skusByListing = new Map<string, ProductSku[]>();
  for (const sku of allSkus) {
    const arr = skusByListing.get(sku.listingId) ?? [];
    arr.push(sku);
    skusByListing.set(sku.listingId, arr);
  }

  const products: Product[] = [];
  const seenSlugs = new Set<string>();
  for (const listing of listings) {
    if (listing.status !== 'active') continue; // only active listings show on storefront
    const product = listingToProduct(listing, skusByListing.get(listing.id) ?? []);
    // A product with no sellable price would check out at ₹0 — keep it off the storefront
    // (same rule the sheet source used: live means price > 0).
    if (product.price <= 0) continue;
    if (!product.slug || seenSlugs.has(product.slug)) {
      console.warn(`[catalog-storefront] Skipping listing ${listing.id}: empty or duplicate slug "${product.slug}".`);
      continue;
    }
    seenSlugs.add(product.slug);
    products.push(product);
  }
  return products;
}

/** Active Firestore listings matching the given listing IDs (no overrides applied). */
export async function getCatalogProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const all = await getCatalogProducts();
  const idSet = new Set(ids);
  return all.filter((p) => idSet.has(p.id));
}

/**
 * Firestore catalogue with admin overrides applied (hidden ones removed),
 * preceded by non-hidden manual products. Override / manual-product read
 * failures are logged and ignored so the catalogue still loads.
 */
export async function getCatalogWithOverrides(): Promise<{ products: Product[]; isMock: boolean }> {
  const [catalogProducts, overrides, manualRaw] = await Promise.all([
    getCatalogProducts(),
    getProductOverrides().catch((error): Map<string, ProductOverride> => {
      console.error('[catalog-storefront] Could not load product overrides:', error);
      return new Map();
    }),
    getManualProducts().catch((error): ManualProduct[] => {
      console.error('[catalog-storefront] Could not load manual products:', error);
      return [];
    }),
  ]);

  const withOverrides = catalogProducts
    .filter((p) => overrides.get(p.id)?.hidden !== true)
    .map((p) => {
      const override = overrides.get(p.id);
      if (!override) return p;
      return { ...mergeOverride(p, override), featured: override.featured === true };
    });

  const manualProducts = manualRaw.filter((m) => m.hidden !== true).map(manualToProduct);

  return { products: [...manualProducts, ...withOverrides], isMock: false };
}
