import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About',
  description:
    "Vellee Luxe is a men's shirt brand built on a simple belief: you shouldn't have to choose between quality and cost.",
  alternates: { canonical: '/about' },
};

const values = [
  {
    title: 'Cloth first',
    body: 'Oxford, linen, poplin — chosen for how they feel on the skin and how they hold up after the twentieth wash, not just the first.',
  },
  {
    title: 'Nothing extra',
    body: 'No oversized logos, no gimmicks. A good collar, clean seams and buttons that stay on.',
  },
  {
    title: 'Honest pricing',
    body: 'We sell directly to you online, without showrooms or middlemen, and keep our prices where they should be.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-sand">
        <div className="container-page py-20 md:py-32">
          <p className="label-caps text-oxford">About Vellee Luxe</p>
          <h1 className="mt-6 max-w-3xl font-serif text-3xl leading-snug text-ink md:text-5xl md:leading-tight">
            Vellee Luxe is a men&rsquo;s fashion brand built around a simple belief: you shouldn&rsquo;t have to choose
            between quality and cost.
          </h1>
        </div>
      </section>

      <section className="container-page py-20 md:py-28">
        <div className="prose-editorial mx-auto max-w-2xl">
          <p>
            It started with a familiar frustration. The shirts we liked cost far more than they should have, and the ones
            we could afford lost their shape within a season. There didn&rsquo;t seem to be much in between.
          </p>
          <p>
            So we started small, with one thing: the shirt. The piece most men wear more often than anything else — to
            work, to dinner, to a wedding, on an ordinary Tuesday. We wanted to get that one thing right.
          </p>
          <p>
            Every Vellee Luxe shirt is prepared for your order and checked by hand before it is sent to you. We would
            rather offer fewer shirts, done well, than fill a warehouse with stock that doesn&rsquo;t meet the standard.
          </p>
          <p>
            We&rsquo;re a young brand, and we&rsquo;re still learning. If something isn&rsquo;t right, tell us — we read
            every message and we&rsquo;ll make it right.
          </p>
        </div>
      </section>

      <section className="border-t border-sand bg-sand/40">
        <div className="container-page grid gap-12 py-20 md:grid-cols-3 md:py-24">
          {values.map((value) => (
            <div key={value.title}>
              <h2 className="label-caps text-ink">{value.title}</h2>
              <p className="mt-4 font-serif text-lg leading-relaxed text-slateGrey">{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-20 text-center md:py-24">
        <p className="font-serif text-2xl italic text-ink">See what we&rsquo;ve made.</p>
        <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg', width: 'auto', className: 'mt-8' })}>
          Shop Shirts
        </Link>
      </section>
    </>
  );
}
