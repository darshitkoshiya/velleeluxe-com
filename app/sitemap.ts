import type { MetadataRoute } from 'next';
import { getCatalogProducts } from '@/lib/catalog-storefront';
import { SITE_URL } from '@/lib/utils';

export const revalidate = 3600;

// /privacy and /returns are redirect aliases, so the canonical policy URLs are listed instead.
const STATIC_PATHS = [
  '',
  '/shop',
  '/about',
  '/size-guide',
  '/contact',
  '/shipping-policy',
  '/return-policy',
  '/privacy-policy',
  '/terms',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalogProducts();
  const now = new Date();

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: (path === '' || path === '/shop' ? 'daily' : 'monthly') as 'daily' | 'monthly',
      priority: path === '' ? 1 : path === '/shop' ? 0.9 : 0.7,
    })),
    ...products.map((product) => ({
      url: `${SITE_URL}/product/${product.slug}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
