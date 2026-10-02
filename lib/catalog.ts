/**
 * Storefront product access.
 *
 * Reads exclusively from the Firestore catalogue (lib/catalog-storefront.ts).
 * No placeholder fallback: if Firestore has no live products (or fails), the
 * shop shows no products. Server-only.
 */
import { getCatalogWithOverrides } from './catalog-storefront';
import type { ColourVariant, Product } from './types';

export interface Catalog {
  products: Product[];
  /** Always false: placeholder products are no longer shown. Kept for callers. */
  isMock: boolean;
}

/**
 * Real products only (no placeholders): non-hidden manual products followed by
 * active Firestore catalogue listings with admin overrides applied (hidden ones
 * removed). Also used by checkout (lib/orders.ts) to price orders, so checkout
 * charges what the shop shows. Throws if the Firestore catalogue can't be read.
 */
export async function getLiveCatalogProducts(): Promise<Product[]> {
  return (await getCatalogWithOverrides()).products;
}

export async function getCatalog(): Promise<Catalog> {
  try {
    const products = await getLiveCatalogProducts();
    return { products, isMock: false };
  } catch (error) {
    console.error('[catalog] Failed to load products:', error);
    return { products: [], isMock: false };
  }
}

export async function getCatalogProducts(): Promise<Product[]> {
  return (await getCatalog()).products;
}

export async function getCatalogProductBySlug(slug: string): Promise<Product | null> {
  const { products } = await getCatalog();
  return products.find((product) => product.slug === slug) ?? null;
}

/** All products sharing the same designId (including the given product itself). */
export async function getCatalogProductsByDesignId(designId: string): Promise<Product[]> {
  const { products } = await getCatalog();
  return products.filter((p) => p.designId === designId);
}

/**
 * Maps product ID → colour variants of its design, for products whose design
 * has 2+ colours. Products without siblings are left out of the map.
 */
export function buildColourVariantMap(products: Product[]): Record<string, ColourVariant[]> {
  const byDesign = new Map<string, ColourVariant[]>();
  for (const p of products) {
    if (!p.designId) continue;
    const list = byDesign.get(p.designId) ?? [];
    list.push({ colour: p.colour, slug: p.slug });
    byDesign.set(p.designId, list);
  }
  const map: Record<string, ColourVariant[]> = {};
  for (const p of products) {
    const variants = p.designId ? byDesign.get(p.designId) : undefined;
    if (variants && variants.length > 1) map[p.id] = variants;
  }
  return map;
}

/** IDs to mark "Best Seller". No real best-seller data yet, so none are marked. */
export function getBestSellerIds(): string[] {
  return [];
}

/** Up to `count` products related by fabric (style), then fit, excluding the product itself. */
export function getRelatedProducts(product: Product, all: Product[], count = 4): Product[] {
  const others = all.filter((p) => p.id !== product.id);
  const score = (p: Product) => (p.style === product.style ? 2 : 0) + (p.fit === product.fit ? 1 : 0);
  return others
    .map((p, index) => ({ p, index, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .slice(0, count)
    .map(({ p }) => p);
}
