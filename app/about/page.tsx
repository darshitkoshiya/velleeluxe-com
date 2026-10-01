import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import { getFreeShippingThreshold } from '@/lib/settings';

// Re-render at most once a minute so the free-shipping amount follows the admin setting.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'About',
  description:
    'Vellee Luxe makes premium shirts for modern India — world-class quality at honest prices, sourced from the finest mills and crafted with precision.',
  alternates: { canonical: '/about' },
};

const getPromises = (freeShippingThreshold: number) => [
  {
    title: 'Free shipping',
    body: `On every order over ₹${freeShippingThreshold.toLocaleString('en-IN')}, delivered anywhere in India.`,
  },
  {
    title: 'Easy 7-day returns',
    body: 'Not quite right? Return or exchange within 7 days of delivery, no awkward questions.',
  },
  {
    title: 'Real human support',
    body: 'Message us on WhatsApp and a real person replies — about sizing, an order, or anything else.',
  },
];

const fabrics = [
  {
    name: 'Linen',
    texture: 'Crisp, slubbed and naturally textured. Softens beautifully with every wash.',
    breathability: 'Exceptional — the coolest cloth for Indian summers.',
    occasion: 'Weekends, travel, beach weddings and long, warm afternoons.',
  },
  {
    name: 'Cotton',
    texture: 'Smooth, soft and even, with a clean finish that holds a press.',
    breathability: 'High — comfortable from the morning commute to dinner.',
    occasion: 'The office, meetings and everyday wear, all year round.',
  },
  {
    name: 'Cotton-Linen Blend',
    texture: 'The softness of cotton with a gentle linen texture and fewer creases.',
    breathability: 'Very high — airy without feeling delicate.',
    occasion: 'Smart-casual days, dinners and relaxed Fridays.',
  },
  {
    name: 'Oxford Weave',
    texture: 'A sturdy basket weave with subtle depth and a soft, lived-in hand.',
    breathability: 'Good — substantial yet comfortable through the day.',
    occasion: 'Workwear, college and weekends, under a blazer or on its own.',
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="label-caps text-oxford">{children}</p>;
}

export default async function AboutPage() {
  const promises = getPromises(await getFreeShippingThreshold());

  return (
    <div className="bg-linen">
      {/* Hero */}
      <section className="border-b border-sand/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32 lg:px-8">
          <SectionLabel>Est. for modern India</SectionLabel>
          <h1 className="mt-6 font-serif text-4xl italic leading-tight text-ink sm:text-5xl md:text-6xl">
            About Vellee Luxe
          </h1>
          <p className="mt-8 max-w-2xl font-sans text-lg leading-relaxed text-ink-muted">
            Premium shirts, designed for the way men in India live and work today — made from the finest cloth and sold
            at an honest price.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="border-b border-sand/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-[1fr_2fr] md:gap-16 md:py-28 lg:px-8">
          <div>
            <SectionLabel>01</SectionLabel>
            <h2 className="mt-4 font-serif text-3xl italic text-ink md:text-4xl">Our Story</h2>
          </div>
          <div className="space-y-5 font-sans text-base leading-relaxed text-ink-muted md:text-lg">
            <p>
              Vellee Luxe makes premium shirts designed for modern India. We were founded on a simple belief: Indian men
              deserve world-class quality at honest prices.
            </p>
            <p>
              Too often, a well-made shirt comes with an inflated price tag, and an affordable one loses its shape after a
              season. We set out to close that gap — no showrooms, no middlemen, just the shirt.
            </p>
            <p>
              Every piece is sourced from the finest mills and crafted with precision: a collar that sits right, seams
              that lie flat and buttons that stay on, wash after wash.
            </p>
          </div>
        </div>
      </section>

      {/* Our Philosophy */}
      <section className="border-b border-sand/30 bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-[1fr_2fr] md:gap-16 md:py-28 lg:px-8">
          <div>
            <SectionLabel>02</SectionLabel>
            <h2 className="mt-4 font-serif text-3xl italic text-ink md:text-4xl">Our Philosophy</h2>
          </div>
          <div>
            <p className="font-serif text-2xl italic leading-snug text-ink md:text-3xl">Quality over quantity.</p>
            <div className="mt-6 space-y-5 font-sans text-base leading-relaxed text-ink-muted md:text-lg">
              <p>
                Every shirt is selected, not just stocked. We would rather offer a smaller collection done well than fill
                a catalogue with pieces that don&rsquo;t meet our standard.
              </p>
              <p>
                We work directly with trusted suppliers, checking cloth, construction and finish so that each piece
                earns its place before it reaches you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Vellee Luxe Promise */}
      <section className="border-b border-sand/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <SectionLabel>03</SectionLabel>
          <h2 className="mt-4 font-serif text-3xl italic text-ink md:text-4xl">The Vellee Luxe Promise</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-sand/30">
            {promises.map((promise, index) => (
              <div
                key={promise.title}
                className={`border-t border-sand/30 pt-8 md:border-t-0 md:pt-0 ${index === 0 ? 'md:pr-10' : 'md:px-10'}`}
              >
                <h3 className="font-sans text-sm font-medium uppercase tracking-[0.14em] text-ink">{promise.title}</h3>
                <p className="mt-3 font-sans text-base leading-relaxed text-ink-muted">{promise.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Fabrics */}
      <section className="border-b border-sand/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <SectionLabel>04</SectionLabel>
          <h2 className="mt-4 font-serif text-3xl italic text-ink md:text-4xl">Our Fabrics</h2>
          <p className="mt-4 max-w-2xl font-sans text-base leading-relaxed text-ink-muted">
            Four cloths, each chosen for how it feels on the skin and how it holds up in the Indian climate.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {fabrics.map((fabric) => (
              <article key={fabric.name} className="border border-sand/60 bg-surface p-6 md:p-8">
                <h3 className="font-serif text-2xl italic text-ink">{fabric.name}</h3>
                <dl className="mt-6 space-y-4 font-sans text-sm leading-relaxed">
                  <div>
                    <dt className="label-caps text-pebble">Texture</dt>
                    <dd className="mt-1 text-ink-muted">{fabric.texture}</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-pebble">Breathability</dt>
                    <dd className="mt-1 text-ink-muted">{fabric.breathability}</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-pebble">Occasion</dt>
                    <dd className="mt-1 text-ink-muted">{fabric.occasion}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 md:py-24 lg:px-8">
        <p className="font-serif text-2xl italic text-ink md:text-3xl">See what we&rsquo;ve made.</p>
        <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
          Shop Shirts
        </Link>
      </section>
    </div>
  );
}
