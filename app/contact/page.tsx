import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
import { SUPPORT_EMAIL } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about sizing, an order or a return? Write to Vellee Luxe — we respond within 24 hours.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="container-page py-16 md:py-24">
      <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr]">
        <header>
          <p className="label-caps text-oxford">Get in touch</p>
          <h1 className="mt-4 font-sans text-3xl font-medium text-ink md:text-4xl">Contact</h1>
          <p className="mt-6 max-w-md font-serif text-lg leading-relaxed text-slateGrey">
            Questions about sizing, an order, or a return? Send us a note — a real person reads every message.
          </p>
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="label-caps text-ink">Email</dt>
              <dd className="mt-2">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-sans text-base text-persimmon hover:text-ink">
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label-caps text-ink">Response time</dt>
              <dd className="mt-2 font-serif text-base italic text-slateGrey">We respond within 24 hours.</dd>
            </div>
          </dl>
        </header>

        <section aria-label="Contact form">
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
