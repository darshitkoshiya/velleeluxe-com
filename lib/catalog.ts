/**
 * Storefront product access with a placeholder fallback.
 *
 * Wraps lib/sheets.ts: if the sheet returns no live products (or fails),
 * the mock catalogue from lib/products-mock.ts is shown instead so the shop
 * never looks empty. Server-only.
 */
import { getProducts } from './sheets';
import { getMockProductBySlug, MOCK_BEST_SELLER_IDS, mockProducts } from './products-mock';
import { applyOverrides, getManualProducts, getProductOverrides, visibleManualProducts } from './product-overrides';
import type { ColourVariant, ManualProduct, Product, ProductOverride } from './types';

export interface Catalog {
  products: Product[];
  /** True when the placeholder products are being shown. */
  isMock: boolean;
}

/**
 * Real products only (no placeholders): sheet products with admin overrides applied
 * (hidden ones removed), followed by non-hidden manual products. If Firestore is
 * unavailable, sheet products are returned unchanged.
 */
export async function getLiveCatalogProducts(): Promise<Product[]> {
  const [sheetProducts, overrides, manual] = await Promise.all([
    getProducts(),
    getProductOverrides().catch((error): Map<string, ProductOverride> => {
      console.error('[catalog] Could not load product overrides:', error);
      return new Map();
    }),
    getManualProducts().catch((error): ManualProduct[] => {
      console.error('[catalog] Could not load manual products:', error);
      return [];
    }),
  ]);
  return [...applyOverrides(sheetProducts, overrides), ...visibleManualProducts(manual)];
}

export async function getCatalog(): Promise<Catalog> {
  try {
    const products = await getLiveCatalogProducts();
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
