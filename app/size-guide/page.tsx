import type { Metadata } from 'next';
import Link from 'next/link';
import { SizeChartTable } from '@/components/product/SizeChartTable';

export const metadata: Metadata = {
  title: 'Size Guide',
  description: "Vellee Luxe men's shirt size chart — neck, chest, shoulder, sleeve and length in inches and centimetres, plus how to measure.",
  alternates: { canonical: '/size-guide' },
};

const steps = [
  {
    title: 'Neck',
    body: 'Measure around the base of your neck, where a shirt collar sits. Keep one finger between the tape and your neck for comfort.',
  },
  {
    title: 'Chest',
    body: 'Measure around the fullest part of your chest, just under the armpits, keeping the tape level across your back.',
  },
  {
    title: 'Shoulder',
    body: 'Measure straight across your back, from the edge of one shoulder bone to the other.',
  },
  {
    title: 'Sleeve',
    body: 'With your arm relaxed at your side, measure from the shoulder seam down to your wrist bone.',
  },
  {
    title: 'Length',
    body: 'Measure from the highest point of the shoulder, next to the collar, down to where you want the shirt to end.',
  },
];

const fits = [
  { name: 'Tailored', body: 'Close through the chest and waist with a clean line. Ideal tucked in or under a blazer.' },
  { name: 'Relaxed', body: 'A little extra room through the body for easy, all-day comfort. Works tucked or untucked.' },
  { name: 'Oversized', body: 'Deliberately generous, with a dropped shoulder. Choose your usual size for the intended look.' },
];

export default function SizeGuidePage() {
  return (
    <div className="container-page py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="label-caps text-oxford">Fit</p>
        <h1 className="mt-4 font-sans text-3xl font-medium text-ink md:text-4xl">Size Guide</h1>
        <p className="mt-4 font-serif text-lg leading-relaxed text-slateGrey">
          The measurements below are body measurements. Measure yourself over a thin shirt, with a soft tape, standing
          naturally.
        </p>
      </header>

      <section aria-labelledby="chart-title" className="mt-14">
        <h2 id="chart-title" className="label-caps mb-6 text-ink">
          Men&rsquo;s Shirt Sizes
        </h2>
        <SizeChartTable />
        <p className="mt-4 font-serif text-base italic text-slateGrey">
          Between two sizes? Choose the larger one for a relaxed feel, the smaller one for a sharper fit.
        </p>
      </section>

      <div className="mt-20 grid gap-16 lg:grid-cols-2">
        <section aria-labelledby="measure-title">
          <h2 id="measure-title" className="label-caps mb-8 text-ink">
            How to Measure
          </h2>
          <ol className="space-y-8">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-5">
                <span className="font-sans text-sm font-medium text-persimmon">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-sans text-base font-medium text-ink">{step.title}</h3>
                  <p className="mt-1 font-serif text-base leading-relaxed text-slateGrey">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="fits-title">
          <h2 id="fits-title" className="label-caps mb-8 text-ink">
            Our Fits
          </h2>
          <div className="space-y-6">
            {fits.map((fit) => (
              <div key={fit.name} className="border-b border-sand pb-6">
                <h3 className="font-sans text-base font-medium text-ink">{fit.name}</h3>
                <p className="mt-1 font-serif text-base leading-relaxed text-slateGrey">{fit.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 font-serif text-base text-slateGrey">
            Still unsure?{' '}
            <Link href="/contact" className="text-persimmon underline underline-offset-4">
              Write to us
            </Link>{' '}
            with your measurements and we&rsquo;ll recommend a size.
          </p>
        </section>
      </div>
    </div>
  );
}
