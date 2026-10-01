/**
 * Product view tracking + daily-rotated featured products (server-only).
 *
 * Views live at productViews/{slug}/daily/{YYYY-MM-DD} = { slug, date, views }.
 * The homepage featured set is picked from products with 3+ views in the last
 * 7 days, shuffled by a deterministic hash of slug + today's date so it changes
 * daily but stays stable within a day. Cached for 1 hour under FEATURED_PRODUCTS_CACHE_TAG.
 */
import { unstable_cache } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import type { Product } from './types';

export const PRODUCT_VIEWS_COLLECTION = 'productViews';
export const FEATURED_PRODUCTS_CACHE_TAG = 'featured-products';

const FEATURED_COUNT = 4;
const VIEW_WINDOW_DAYS = 7;
const MIN_VIEWS = 3;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The last `days` dates (UTC, YYYY-MM-DD), today included. */
function lastDates(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => new Date(now - i * 86_400_000).toISOString().slice(0, 10));
}

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Adds one view for today. */
export async function recordProductView(slug: string): Promise<void> {
  const date = todayKey();
  await getAdminDb()
    .collection(PRODUCT_VIEWS_COLLECTION)
    .doc(slug)
    .collection('daily')
    .doc(date)
    .set({ slug, date, views: FieldValue.increment(1) }, { merge: true });
}

/** Total views per slug over the last 7 days (slugs with no data map to 0). */
async function fetchViewTotals(slugs: string[]): Promise<Record<string, number>> {
  const totals: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
  if (slugs.length === 0) return totals;

  const db = getAdminDb();
  const dates = lastDates(VIEW_WINDOW_DAYS);
  const refs = slugs.flatMap((slug) =>
    dates.map((date) => db.collection(PRODUCT_VIEWS_COLLECTION).doc(slug).collection('daily').doc(date)),
  );

  // getAll in chunks to keep each request a reasonable size.
  const CHUNK = 300;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const snapshots = await db.getAll(...refs.slice(i, i + CHUNK));
    for (const snap of snapshots) {
      if (!snap.exists) continue;
      const slug = snap.ref.parent.parent?.id;
      const views = Number(snap.get('views')) || 0;
      if (slug && slug in totals) totals[slug] += views;
    }
  }
  return totals;
}

/** Picks the featured slugs for `date` from the given candidate slugs (in catalogue order). */
async function pickFeaturedSlugs(slugs: string[], date: string): Promise<string[]> {
  const totals = await fetchViewTotals(slugs);

  // Eligible: 3+ views in 7 days, rotated daily by a deterministic hash.
  const eligible = slugs
    .filter((slug) => totals[slug] >= MIN_VIEWS)
    .sort((a, b) => hashString(a + date) - hashString(b + date))
    .slice(0, FEATURED_COUNT);

  if (eligible.length >= FEATURED_COUNT) return eligible;

  // Fill up with the most-viewed products regardless of the threshold
  // (ties keep catalogue order, so the homepage is never short).
  const picked = new Set(eligible);
  const fill = slugs
    .map((slug, index) => ({ slug, index, views: totals[slug] }))
    .filter(({ slug }) => !picked.has(slug))
    .sort((a, b) => b.views - a.views || a.index - b.index)
    .slice(0, FEATURED_COUNT - eligible.length)
    .map(({ slug }) => slug);

  return [...eligible, ...fill];
}

const pickFeaturedSlugsCached = unstable_cache(pickFeaturedSlugs, ['vl-featured-products'], {
  revalidate: 3600,
  tags: [FEATURED_PRODUCTS_CACHE_TAG],
});

/**
 * Up to 4 slugs for the homepage featured section, rotated daily by view data.
 * Falls back to the first 4 products if view data can't be read.
 */
export async function getFeaturedProductSlugs(allProducts: Product[]): Promise<string[]> {
  const slugs = allProducts
    .filter((product) => (product as Product & { hidden?: boolean }).hidden !== true)
    .map((product) => product.slug);
  try {
    return await pickFeaturedSlugsCached(slugs, todayKey());
  } catch (error) {
    console.error('[featured-products] Could not load view data:', error);
    return slugs.slice(0, FEATURED_COUNT);
  }
}
