'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { BrandPromiseIcon, type BrandPromiseIconKey } from '@/components/home/BrandPromiseIcon';
import { ProductCard } from '@/components/product/ProductCard';
import { useInView } from '@/hooks/useInView';
import type { Product } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      // A single ref type is fine here: div, li and article are all HTMLElements.
      ref={ref as never}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

const heroDelay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

const primaryButton =
  'inline-flex items-center justify-center gap-2 bg-accent px-8 py-3.5 font-sans text-[13px] font-medium uppercase tracking-[0.1em] text-white transition-colors hover:bg-ink focus-visible:outline-offset-4';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 border border-ink px-8 py-3.5 font-sans text-[13px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-linen focus-visible:outline-offset-4';

/* ------------------------------------------------------------------ */
/* 1. Hero                                                             */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-64px)] flex-col items-center justify-center overflow-hidden bg-linen px-4 text-center">
      <p className="hero-rise label-caps text-ink-muted" style={heroDelay(100)}>
        New Collection 2026
      </p>

      <h1
        className="hero-rise mt-6 font-serif text-6xl font-light leading-[0.95] tracking-tight text-ink sm:text-7xl md:text-9xl"
        style={heroDelay(250)}
      >
        Vellee Luxe
      </h1>

      <div className="hero-rule mt-8 h-px w-24 origin-center bg-sand md:w-32" style={heroDelay(500)} aria-hidden="true" />

      <p className="hero-rise mt-8 font-serif text-xl italic text-ink md:text-2xl" style={heroDelay(650)}>
        Premium shirts for modern India.
      </p>
      <p className="hero-rise mt-3 font-sans text-sm text-ink-muted" style={heroDelay(800)}>
        Crafted for the discerning Indian gentleman.
      </p>

      <div className="hero-rise mt-10" style={heroDelay(950)}>
        <Link href="/shop" className={primaryButton}>
          Explore Collection
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      <a
        href="#fabric"
        className="hero-rise absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-ink-muted"
        style={heroDelay(1300)}
        aria-label="Scroll to learn about our fabrics"
      >
        <span className="font-sans text-[10px] uppercase tracking-[0.2em]">Scroll</span>
        <span className="scroll-cue block h-8 w-px bg-ink-muted" aria-hidden="true" />
      </a>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Fabric story                                                     */
/* ------------------------------------------------------------------ */

const FABRICS = [
  {
    name: 'Linen',
    note: 'Breathable / Textured',
    description: 'Woven from flax for airflow through Indian summers. Softens and gains character with every wash.',
    bg: 'bg-[#EFE6D6]',
    texture:
      'repeating-linear-gradient(0deg, rgba(28,34,48,0.035) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(28,34,48,0.03) 0 1px, transparent 1px 5px)',
  },
  {
    name: 'Cotton',
    note: 'Smooth / Everyday',
    description: 'Long-staple cotton with a clean, crisp hand. Easy to care for, comfortable from desk to dinner.',
    bg: 'bg-surface',
    texture: 'repeating-linear-gradient(45deg, rgba(28,34,48,0.03) 0 1px, transparent 1px 6px)',
  },
  {
    name: 'Oxford',
    note: 'Structured / Durable',
    description: 'A basket weave with quiet texture and body. The dependable shirt that only improves with age.',
    bg: 'bg-[#DCE3EA]',
    texture:
      'repeating-linear-gradient(0deg, rgba(28,34,48,0.05) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 2px, transparent 2px 4px)',
  },
];

function FabricStory() {
  return (
    <section id="fabric" className="scroll-mt-16 bg-linen py-24 md:py-32">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="label-caps text-ink-muted">The Material</p>
          <h2 className="mt-4 font-serif text-4xl font-light text-ink md:text-6xl">Fabric is everything.</h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:mt-20 md:grid-cols-3 md:gap-6">
          {FABRICS.map((fabric, index) => (
            <Reveal key={fabric.name} as="article" delay={index * 100}>
              <div
                className={`flex h-full min-h-[320px] flex-col justify-between p-8 transition-transform duration-500 hover:-translate-y-1 md:min-h-[420px] md:p-10 ${fabric.bg}`}
                style={{ backgroundImage: fabric.texture }}
              >
                <p className="label-caps text-ink-muted">{fabric.note}</p>
                <div>
                  <h3 className="font-serif text-4xl italic text-ink md:text-5xl">{fabric.name}</h3>
                  <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-ink-muted">{fabric.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Featured products                                                */
/* ------------------------------------------------------------------ */

function FeaturedProducts({ products }: { products: Product[] }) {
  return (
    <section className="bg-surface py-24 md:py-32">
      <div className="container-page">
        <Reveal className="flex items-end justify-between gap-6">
          <div>
            <p className="label-caps text-ink-muted">Featured</p>
            <h2 className="mt-4 font-serif text-4xl font-light text-ink md:text-6xl">The Collection</h2>
          </div>
          <Link
            href="/shop"
            className="shrink-0 border-b border-ink pb-1 font-sans text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent hover:text-accent"
          >
            View All
          </Link>
        </Reveal>
      </div>

      {products.length > 0 ? (
        <ul className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 md:mx-auto md:mt-16 md:grid md:max-w-7xl md:grid-cols-4 md:gap-6 md:overflow-visible md:px-6 lg:px-10">
          {products.map((product, index) => (
            <Reveal key={product.id} as="li" delay={index * 100} className="w-[70vw] shrink-0 snap-start sm:w-[42vw] md:w-auto">
              <ProductCard product={product} />
            </Reveal>
          ))}
        </ul>
      ) : (
        <p className="container-page mt-12 font-serif text-lg italic text-ink-muted">New pieces arriving soon.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Brand promise                                                    */
/* ------------------------------------------------------------------ */

/** Mirrors BrandPromiseItem in lib/settings.ts (which is server-only). */
interface BrandPromiseItemClient {
  icon: BrandPromiseIconKey;
  title: string;
  description: string;
}

/** Mirrors DEFAULT_BRAND_PROMISE in lib/settings.ts. */
const DEFAULT_BRAND_PROMISE_CLIENT: BrandPromiseItemClient[] = [
  { icon: 'truck', title: 'Free Shipping', description: 'On all orders over ₹999, delivered across India.' },
  { icon: 'return', title: '7-Day Returns', description: 'Not the right fit? Return or exchange within seven days.' },
  { icon: 'chat', title: 'WhatsApp Support', description: 'Real people, quick answers on sizing, orders and more.' },
];

// Static class names so Tailwind picks them up; columns follow the item count on desktop.
const PROMISE_COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
  5: 'md:grid-cols-3',
  6: 'md:grid-cols-3',
};

function BrandPromise({ items }: { items: BrandPromiseItemClient[] }) {
  return (
    <section className="bg-ink py-20 text-linen md:py-28">
      <div className={`container-page grid grid-cols-1 gap-12 md:gap-8 ${PROMISE_COLUMNS[items.length] ?? 'md:grid-cols-3'}`}>
        {items.map((promise, index) => (
          <Reveal key={`${index}-${promise.title}`} delay={index * 100} className="flex flex-col items-center text-center">
            <span className="text-sand">
              <BrandPromiseIcon icon={promise.icon} />
            </span>
            <h3 className="mt-5 font-serif text-2xl text-white">{promise.title}</h3>
            {promise.description && (
              <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-pebble">{promise.description}</p>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Craft / story                                                    */
/* ------------------------------------------------------------------ */

function CraftStory() {
  return (
    <section className="bg-linen py-24 md:py-32">
      <div className="container-page grid grid-cols-1 items-center gap-14 md:grid-cols-2 md:gap-20">
        <Reveal>
          <p className="label-caps text-ink-muted">Our Craft</p>
          <h2 className="mt-4 font-serif text-4xl font-light text-ink md:text-6xl">Made for Modern India</h2>
          <div className="mt-8 space-y-5 font-sans text-[15px] leading-relaxed text-ink-muted">
            <p>
              Every Vellee Luxe shirt begins with the cloth. We choose linen, cotton and Oxford weaves for how they feel
              on the skin and how they hold up to the Indian climate, not for how they look on a spec sheet.
            </p>
            <p>
              We work with trusted mills and small workshops, keeping our runs deliberately limited. Clean seams,
              considered collars and honest buttons: the details you notice after the hundredth wear.
            </p>
            <p>
              Fewer, better shirts. Fair prices without inflated markdowns. A wardrobe built to last, for the man who
              values quiet confidence over loud logos.
            </p>
          </div>
          <Link
            href="/about"
            className="mt-10 inline-flex items-center gap-2 border-b border-ink pb-1 font-sans text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Our Story <span aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>

        <Reveal delay={150} className="relative">
          <div className="relative aspect-[4/5] overflow-hidden bg-sand">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(28,34,48,0.04) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(28,34,48,0.035) 0 1px, transparent 1px 6px)',
              }}
              aria-hidden="true"
            />
            <div className="absolute inset-8 border border-ink/15 md:inset-12" aria-hidden="true" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
              <p className="font-serif text-7xl font-light italic text-ink/80 md:text-8xl">VL</p>
              <div className="mt-6 h-px w-12 bg-ink/30" aria-hidden="true" />
              <p className="mt-6 label-caps text-ink-muted">Linen &middot; Cotton &middot; Oxford</p>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden h-24 w-24 bg-accent/90 md:block" aria-hidden="true" />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Final CTA                                                        */
/* ------------------------------------------------------------------ */

function FinalCta() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi! I would like to know more about Vellee Luxe shirts.')}`
    : '/contact';

  return (
    <section className="border-t border-sand bg-linen py-24 md:py-36">
      <Reveal className="container-page flex flex-col items-center text-center">
        <h2 className="max-w-3xl font-serif text-4xl font-light leading-tight text-ink md:text-7xl">
          Ready to elevate your wardrobe?
        </h2>
        <div className="mt-12 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
          <Link href="/shop" className={`${primaryButton} w-full sm:w-auto`}>
            Shop Now
          </Link>
          <a
            href={whatsappHref}
            className={`${secondaryButton} w-full sm:w-auto`}
            {...(whatsappNumber ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            WhatsApp Us
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomeView({
  featuredProducts,
  brandPromise = DEFAULT_BRAND_PROMISE_CLIENT,
}: {
  featuredProducts: Product[];
  /**
   * Admin-set threshold (INR) from lib/settings. Currently unused here — the brand promise
   * text is fully admin-editable — but kept so callers can keep passing it.
   */
  freeShippingThreshold?: number;
  /** Admin-edited brand promise items from lib/settings; defaults to the built-in three. */
  brandPromise?: BrandPromiseItemClient[];
}) {
  return (
    <>
      <Hero />
      <FabricStory />
      <FeaturedProducts products={featuredProducts} />
      <BrandPromise items={brandPromise.length > 0 ? brandPromise : DEFAULT_BRAND_PROMISE_CLIENT} />
      <CraftStory />
      <FinalCta />
    </>
  );
}
