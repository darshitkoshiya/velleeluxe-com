import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Size Guide',
  description:
    "Vellee Luxe men's shirt size chart — chest, shoulder and length for S to XXL, how to measure yourself, and our slim and regular fits.",
  alternates: { canonical: '/size-guide' },
};

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

const chartRows: Array<{ label: string; unit: string; values: number[] }> = [
  { label: 'Chest', unit: 'in', values: [38, 40, 42, 44, 46] },
  { label: 'Chest', unit: 'cm', values: [96, 101, 107, 112, 117] },
  { label: 'Shoulder', unit: 'in', values: [16.5, 17, 17.5, 18, 18.5] },
  { label: 'Length', unit: 'in', values: [29, 30, 30.5, 31, 31.5] },
];

const steps = [
  {
    title: 'Chest',
    body: 'Wrap the tape around the fullest part of your chest, just under the armpits. Keep it level across your back and snug, but not tight — you should be able to slip one finger underneath.',
  },
  {
    title: 'Shoulder',
    body: 'Stand straight and measure across your upper back, from the outer edge of one shoulder bone to the other. It helps to have someone else hold the tape.',
  },
  {
    title: 'Length',
    body: 'Measure from the highest point of the shoulder, next to the collar, straight down to where you want the shirt to end. Or measure a shirt you already love, collar seam to hem.',
  },
];

const fits = [
  {
    name: 'Slim Fit',
    body: 'Cut closer through the chest and waist for a sharp, tailored line. Best tucked in, under a blazer, or for a leaner build. If you prefer room to move, size up.',
  },
  {
    name: 'Regular Fit',
    body: 'A classic cut with comfortable room through the chest and body. Easy to wear tucked or untucked, from the office to the weekend. Choose your usual size.',
  },
];

export default function SizeGuidePage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Vellee Luxe, I need help choosing a size.')}`
    : '/contact';
  const isExternal = Boolean(whatsappNumber);

  return (
    <div className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <header className="max-w-2xl">
          <p className="label-caps text-oxford">Size Guide</p>
          <h1 className="mt-4 font-serif text-4xl italic text-ink md:text-5xl">Find Your Perfect Fit</h1>
          <p className="mt-5 font-sans text-base leading-relaxed text-ink-muted md:text-lg">
            Use a soft measuring tape and measure over a thin T-shirt, standing naturally. Compare your numbers with the
            chart below.
          </p>
        </header>

        {/* Size chart */}
        <section aria-labelledby="chart-title" className="mt-14 border-t border-sand/30 pt-14">
          <h2 id="chart-title" className="font-serif text-2xl italic text-ink md:text-3xl">
            Shirt Size Chart
          </h2>
          <div className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] border-collapse bg-surface font-sans text-sm">
              <caption className="sr-only">Vellee Luxe shirt measurements by size</caption>
              <thead>
                <tr className="border-b border-ink">
                  <th scope="col" className="px-4 py-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-ink">
                    Measurement
                  </th>
                  {SIZES.map((size) => (
                    <th
                      key={size}
                      scope="col"
                      className="px-4 py-4 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-ink"
                    >
                      {size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={`${row.label}-${row.unit}`} className="border-b border-sand/30 last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-left font-medium text-ink">
                      {row.label} <span className="font-normal text-ink-muted">({row.unit === 'in' ? 'inches' : 'cm'})</span>
                    </th>
                    {row.values.map((value, index) => (
                      <td key={SIZES[index]} className="px-4 py-4 text-center tabular-nums text-ink-muted">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-sans text-sm text-ink-muted">
            Between two sizes? Choose the larger one for a relaxed feel, the smaller one for a sharper fit.
          </p>
        </section>

        <div className="mt-20 grid gap-16 border-t border-sand/30 pt-16 lg:grid-cols-2 lg:gap-20">
          {/* How to measure */}
          <section aria-labelledby="measure-title">
            <h2 id="measure-title" className="font-serif text-2xl italic text-ink md:text-3xl">
              How to Measure
            </h2>
            <ol className="mt-8 space-y-8">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-5">
                  <span className="font-sans text-sm font-medium tabular-nums text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-sans text-base font-medium text-ink">{step.title}</h3>
                    <p className="mt-2 font-sans text-base leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Fit guide */}
          <section aria-labelledby="fits-title">
            <h2 id="fits-title" className="font-serif text-2xl italic text-ink md:text-3xl">
              Fit Guide
            </h2>
            <div className="mt-8 space-y-6">
              {fits.map((fit) => (
                <div key={fit.name} className="border border-sand/60 bg-surface p-6">
                  <h3 className="label-caps text-ink">{fit.name}</h3>
                  <p className="mt-3 font-sans text-base leading-relaxed text-ink-muted">{fit.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Help */}
        <section className="mt-20 border-t border-sand/30 pt-12 text-center">
          <p className="font-serif text-2xl italic text-ink">Still unsure?</p>
          <p className="mt-3 font-sans text-base text-ink-muted">
            Send us your measurements and we&rsquo;ll recommend the right size.
          </p>
          {isExternal ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block font-sans text-sm font-medium uppercase tracking-[0.14em] text-accent underline underline-offset-8 transition-colors hover:text-ink"
            >
              Chat with us on WhatsApp
            </a>
          ) : (
            <Link
              href={whatsappHref}
              className="mt-6 inline-block font-sans text-sm font-medium uppercase tracking-[0.14em] text-accent underline underline-offset-8 transition-colors hover:text-ink"
            >
              Contact us
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
