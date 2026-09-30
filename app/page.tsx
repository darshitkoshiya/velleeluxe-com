import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL, SUPPORT_EMAIL, toJsonLd } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: 'Vellee Luxe — Premium Shirts for Modern India' },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vellee Luxe',
  url: SITE_URL,
  email: SUPPORT_EMAIL,
  description: 'Premium shirts for modern India.',
};

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100svh-64px)] flex-col items-center justify-center bg-linen px-4 text-center">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(organizationJsonLd) }} />

      <p className="mb-6 font-sans text-[11px] uppercase tracking-[0.25em] text-oxford">New Collection</p>

      <h1 className="mb-4 font-sans text-[clamp(2rem,8vw,5rem)] font-semibold uppercase leading-none tracking-[0.08em] text-ink">
        Vellee Luxe
      </h1>

      <div className="mb-6 h-px w-16 bg-sand" />

      <p className="mb-2 max-w-md font-serif text-[clamp(1.1rem,3vw,1.5rem)] italic text-ink-muted">
        Premium shirts for modern India.
      </p>

      <p className="mb-10 font-sans text-[13px] tracking-wide text-pebble">New collection arriving soon.</p>

      <Link
        href="/shop"
        className="inline-flex items-center gap-2 bg-accent px-8 py-3.5 font-sans text-[13px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:bg-accent/90"
      >
        Explore the collection
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );
}
