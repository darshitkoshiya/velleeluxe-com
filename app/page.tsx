import type { Metadata } from 'next';
import HomeView from '@/components/home/HomeView';
import { getCatalog } from '@/lib/catalog';
import { SITE_URL, SUPPORT_EMAIL, toJsonLd } from '@/lib/utils';

// Server wrapper: fetches products + provides metadata/JSON-LD.
// All animation lives in the client component <HomeView />.
export const revalidate = 60;

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
  const { products } = await getCatalog();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }} />
      <HomeView featuredProducts={products.slice(0, 4)} />
    </>
  );
}
