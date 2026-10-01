/**
 * Admin analytics (server-only — uses the Firebase Admin SDK).
 *
 * Built from every order in Firestore plus product view counts from
 * productViews/{slug}/daily/{YYYY-MM-DD}. Cached for 15 minutes under the
 * ANALYTICS_CACHE_TAG tag; lib/orders.ts revalidates it whenever an order changes.
 */
import { unstable_cache } from 'next/cache';
import { getAdminDb } from './firebase-admin';
import { PRODUCT_VIEWS_COLLECTION } from './featured-products';
import { listOrders } from './orders';
import type { Order, OrderStatus } from './types';

export const ANALYTICS_CACHE_TAG = 'analytics';

const DAYS = 30;
const TOP_N = 10;
const PAID_STATUSES: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'delivered'];

export interface DailyRevenue {
  date: string; // YYYY-MM-DD
  revenue: number;
  orderCount: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  slug?: string;
  image?: string;
  unitsSold: number;
  revenue: number;
  /** Views over the last 30 days, from the productViews collection. */
  views: number;
  /** unitsSold / views * 100, or 0 if no views. */
  conversionRate: number;
}

export interface LocationStat {
  city: string;
  state: string;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsSummary {
  /** All time, paid orders only. */
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalOrders: number;
  ordersThisMonth: number;
  /** totalRevenue / totalOrders. */
  averageOrderValue: number;
  /** Last 30 days, sorted by date ascending. */
  dailyRevenue: DailyRevenue[];
  /** Top 10 by revenue. */
  topProducts: TopProduct[];
  /** Top 10 cities by order count. */
  locationStats: LocationStat[];
  /** % of customers (by email) with 2+ paid orders. */
  repeatCustomerRate: number;
}

function isPaid(order: Order): boolean {
  return PAID_STATUSES.includes(order.status);
}

/** The last `days` dates (UTC, YYYY-MM-DD), oldest first, today last. */
function lastDates(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** "YYYY-MM" for the current month and the previous one (UTC). */
function monthKeys(): { thisMonth: string; lastMonth: string } {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { thisMonth, lastMonth: last.toISOString().slice(0, 7) };
}

/** Total views per slug over the given dates. */
async function fetchViews(slugs: string[], dates: string[]): Promise<Record<string, number>> {
  const totals: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
  if (slugs.length === 0) return totals;

  const db = getAdminDb();
  const refs = slugs.flatMap((slug) =>
    dates.map((date) => db.collection(PRODUCT_VIEWS_COLLECTION).doc(slug).collection('daily').doc(date)),
  );
  const CHUNK = 300;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const snapshots = await db.getAll(...refs.slice(i, i + CHUNK));
    for (const snap of snapshots) {
      if (!snap.exists) continue;
      const slug = snap.ref.parent.parent?.id;
      if (slug && slug in totals) totals[slug] += Number(snap.get('views')) || 0;
    }
  }
  return totals;
}

async function computeAnalytics(): Promise<AnalyticsSummary> {
  const paid = (await listOrders()).filter(isPaid);
  const { thisMonth, lastMonth } = monthKeys();
  const dates = lastDates(DAYS);

  let totalRevenue = 0;
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let ordersThisMonth = 0;

  const daily = new Map<string, DailyRevenue>(dates.map((date) => [date, { date, revenue: 0, orderCount: 0 }]));
  const products = new Map<string, Omit<TopProduct, 'views' | 'conversionRate'>>();
  const locations = new Map<string, LocationStat>();
  const ordersPerEmail = new Map<string, number>();

  for (const order of paid) {
    const total = Number(order.total) || 0;
    const created = order.createdAt ?? '';
    totalRevenue += total;

    const month = created.slice(0, 7);
    if (month === thisMonth) {
      revenueThisMonth += total;
      ordersThisMonth += 1;
    } else if (month === lastMonth) {
      revenueLastMonth += total;
    }

    const day = daily.get(created.slice(0, 10));
    if (day) {
      day.revenue += total;
      day.orderCount += 1;
    }

    for (const item of order.items ?? []) {
      const quantity = Number(item.quantity) || 0;
      const lineRevenue = quantity * (Number(item.price) || 0);
      const existing = products.get(item.productId);
      if (existing) {
        existing.unitsSold += quantity;
        existing.revenue += lineRevenue;
        existing.slug ??= item.slug;
        existing.image ??= item.image;
      } else {
        products.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          slug: item.slug,
          image: item.image,
          unitsSold: quantity,
          revenue: lineRevenue,
        });
      }
    }

    const city = (order.shippingAddress?.city ?? '').trim() || 'Unknown';
    const state = (order.shippingAddress?.state ?? '').trim();
    const locationKey = `${city.toLowerCase()}::${state.toLowerCase()}`;
    const location = locations.get(locationKey);
    if (location) {
      location.orderCount += 1;
      location.revenue += total;
    } else {
      locations.set(locationKey, { city, state, orderCount: 1, revenue: total });
    }

    const email = (order.customerEmail ?? '').trim().toLowerCase();
    if (email) ordersPerEmail.set(email, (ordersPerEmail.get(email) ?? 0) + 1);
  }

  const top = Array.from(products.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_N);

  let views: Record<string, number> = {};
  try {
    const slugs = Array.from(new Set(top.map((product) => product.slug).filter((slug): slug is string => !!slug)));
    views = await fetchViews(slugs, dates);
  } catch (error) {
    console.error('[analytics] Could not load product views:', error);
  }

  const topProducts: TopProduct[] = top.map((product) => {
    const productViews = product.slug ? views[product.slug] ?? 0 : 0;
    return {
      ...product,
      views: productViews,
      conversionRate: productViews > 0 ? (product.unitsSold / productViews) * 100 : 0,
    };
  });

  const locationStats = Array.from(locations.values())
    .sort((a, b) => b.orderCount - a.orderCount || b.revenue - a.revenue)
    .slice(0, TOP_N);

  const customers = ordersPerEmail.size;
  const repeatCustomers = Array.from(ordersPerEmail.values()).filter((count) => count >= 2).length;

  return {
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    totalOrders: paid.length,
    ordersThisMonth,
    averageOrderValue: paid.length > 0 ? totalRevenue / paid.length : 0,
    dailyRevenue: dates.map((date) => daily.get(date)!),
    topProducts,
    locationStats,
    repeatCustomerRate: customers > 0 ? (repeatCustomers / customers) * 100 : 0,
  };
}

const getAnalyticsCached = unstable_cache(computeAnalytics, ['vl-admin-analytics'], {
  revalidate: 900,
  tags: [ANALYTICS_CACHE_TAG],
});

/** Store analytics for the admin panel (cached 15 minutes). */
export async function getAnalytics(): Promise<AnalyticsSummary> {
  return getAnalyticsCached();
}
