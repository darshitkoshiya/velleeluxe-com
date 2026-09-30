/**
 * Storefront product access with a placeholder fallback.
 *
 * Wraps lib/sheets.ts: if the sheet returns no live products (or fails),
 * the mock catalogue from lib/products-mock.ts is shown instead so the shop
 * never looks empty. Server-only.
 */
import { getProducts } from './sheets';
import { getMockProductBySlug, MOCK_BEST_SELLER_IDS, mockProducts } from './products-mock';
import type { Product } from './types';

export interface Catalog {
  products: Product[];
  /** True when the placeholder products are being shown. */
  isMock: boolean;
}

export async function getCatalog(): Promise<Catalog> {
  try {
    const products = await getProducts();
    if (products.length > 0) return { products, isMock: false };
  } catch (error) {
    console.error('[catalog] Failed to load products, using placeholders:', error);
  }
  return { products: mockProducts, isMock: true };
}

export async function getCatalogProducts(): Promise<Product[]> {
  return (await getCatalog()).products;
}

export async function getCatalogProductBySlug(slug: string): Promise<Product | null> {
  const { products, isMock } = await getCatalog();
  const found = products.find((product) => product.slug === slug);
  if (found) return found;
  return isMock ? getMockProductBySlug(slug) : null;
}

/** IDs to mark "Best Seller". Only placeholders have this data for now. */
export function getBestSellerIds(): string[] {
  return Array.from(MOCK_BEST_SELLER_IDS);
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
