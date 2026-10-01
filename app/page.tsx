import type { Metadata } from 'next';
import HomeView from '@/components/home/HomeView';
import { getCatalog } from '@/lib/catalog';
import { getFeaturedProductSlugs } from '@/lib/featured-products';
import type { Product } from '@/lib/types';
import { getBrandPromise, getFreeShippingThreshold } from '@/lib/settings';
import { SITE_URL, SUPPORT_EMAIL, toJsonLd } from '@/lib/utils';

// Server wrapper: fetches products + provides metadata/JSON-LD.
// All animation lives in the client component <HomeView />.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Vellee Luxe — Premium Men's Shirts" },
  alternates: { canonical: '/' },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vellee Luxe',
  url: SITE_URL,
  email: SUPPORT_EMAIL,
  description: 'Premium shirts for modern India.',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Vellee Luxe',
  url: SITE_URL,
};

export default async function HomePage() {
  const [{ products }, freeShippingThreshold, brandPromise] = await Promise.all([
    getCatalog(),
    getFreeShippingThreshold(),
    getBrandPromise(),
  ]);

  // Admin-flagged featured products first, then fill with the daily view-based rotation.
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const adminFeatured = products.filter((product) => product.featured === true);
  const rotationSlugs = await getFeaturedProductSlugs(products.filter((product) => product.featured !== true));
  const featuredProducts = [
    ...adminFeatured,
    ...rotationSlugs.map((slug) => bySlug.get(slug)).filter((product): product is Product => Boolean(product)),
  ].slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }} />
      <HomeView
        featuredProducts={featuredProducts.length > 0 ? featuredProducts : products.slice(0, 4)}
        freeShippingThreshold={freeShippingThreshold}
        brandPromise={brandPromise}
      />
    </>
  );
}
