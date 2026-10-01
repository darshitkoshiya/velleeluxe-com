import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/contact/ContactForm';
import { getFreeShippingThreshold } from '@/lib/settings';

// Re-render at most once a minute so the free-shipping amount follows the admin setting.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Questions about sizing, an order or a return? Reach Vellee Luxe on WhatsApp or email — Monday to Saturday, 10am to 7pm IST.',
  alternates: { canonical: '/contact' },
};

const CONTACT_EMAIL = 'hello@velleeluxe.com';

const getFaqs = (freeShippingThreshold: number) => [
  {
    question: 'How long does shipping take?',
    answer: `Orders are dispatched within 1–2 working days and usually arrive in 3–7 working days, depending on your pincode. Shipping is free on orders over ₹${freeShippingThreshold.toLocaleString('en-IN')}.`,
  },
  {
    question: 'What is your return policy?',
    answer:
      'You can exchange a product within 7 days of delivery, as long as it is unworn, unwashed and has its tags intact. Message us on WhatsApp or raise a request from My Account and we will arrange a pickup. Resolutions are issued as store credit or an exchange — see our Return Policy for full details.',
  },
  {
    question: 'How do I find the right size?',
    answer:
      'Our Size Guide lists chest, shoulder and length measurements for every size, with simple instructions for measuring yourself. If you are between sizes, message us your measurements and we will recommend one.',
  },
  {
    question: 'Which payment methods do you accept?',
    answer:
      'We accept UPI, debit and credit cards, net banking and popular wallets, all processed securely by Razorpay. Cash on Delivery is available on eligible pincodes.',
  },
  {
    question: 'How can I track my order?',
    answer:
      'As soon as your order ships, we send a tracking link by email and SMS. You can also message us on WhatsApp with your order number and we will share the latest status.',
  },
];

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.05 2C6.53 2 2.06 6.47 2.06 11.99c0 1.76.46 3.48 1.34 5L2 22l5.14-1.35a9.94 9.94 0 0 0 4.9 1.25h.01c5.51 0 9.99-4.47 9.99-9.99C22.04 6.47 17.56 2 12.05 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.05.8.82-2.97-.2-.31a8.2 8.2 0 1 1 6.93 3.81Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

export default async function ContactPage() {
  const faqs = getFaqs(await getFreeShippingThreshold());
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Vellee Luxe, I have a question.')}`
    : null;

  return (
    <div className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <header className="max-w-2xl">
          <p className="label-caps text-oxford">Contact</p>
          <h1 className="mt-4 font-serif text-4xl italic text-ink md:text-5xl">Get in Touch</h1>
          <p className="mt-5 font-sans text-base leading-relaxed text-ink-muted md:text-lg">
            Questions about sizing, an order or a return? A real person reads every message.
          </p>
        </header>

        <div className="mt-14 grid gap-14 border-t border-sand/30 pt-14 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          {/* Contact details */}
          <dl className="space-y-10">
            <div>
              <dt className="label-caps text-ink">WhatsApp</dt>
              <dd className="mt-3">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-sans text-base text-accent transition-colors hover:text-ink"
                  >
                    <WhatsAppGlyph />
                    Chat with us on WhatsApp
                  </a>
                ) : (
                  <span className="font-sans text-base text-ink-muted">Coming soon</span>
                )}
                <p className="mt-2 font-sans text-sm text-ink-muted">The fastest way to reach us.</p>
              </dd>
            </div>
            <div>
              <dt className="label-caps text-ink">Email</dt>
              <dd className="mt-3">
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-sans text-base text-accent transition-colors hover:text-ink">
                  {CONTACT_EMAIL}
                </a>
                <p className="mt-2 font-sans text-sm text-ink-muted">We reply within one working day.</p>
              </dd>
            </div>
            <div>
              <dt className="label-caps text-ink">Business hours</dt>
              <dd className="mt-3 font-sans text-base text-ink-muted">
                Monday &ndash; Saturday
                <br />
                10am &ndash; 7pm IST
              </dd>
            </div>
          </dl>

          {/* Form */}
          <section aria-label="Contact form">
            <ContactForm />
          </section>
        </div>
      </div>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="border-t border-sand/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <div>
              <p className="label-caps text-oxford">Help</p>
              <h2 id="faq-title" className="mt-4 font-serif text-3xl italic text-ink md:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-4 font-sans text-sm leading-relaxed text-ink-muted">
                See our <Link href="/size-guide" className="text-accent underline underline-offset-4 hover:text-ink">Size Guide</Link>{' '}
                and <Link href="/return-policy" className="text-accent underline underline-offset-4 hover:text-ink">Return Policy</Link>{' '}
                for more detail.
              </p>
            </div>
            <div className="border-t border-sand/30">
              {faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-sand/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-sans text-base font-medium text-ink transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span
                      aria-hidden="true"
                      className="relative h-3 w-3 shrink-0 before:absolute before:left-0 before:top-1/2 before:h-px before:w-3 before:-translate-y-1/2 before:bg-current after:absolute after:left-1/2 after:top-0 after:h-3 after:w-px after:-translate-x-1/2 after:bg-current after:transition-transform group-open:after:scale-y-0"
                    />
                  </summary>
                  <p className="max-w-2xl pb-6 font-sans text-base leading-relaxed text-ink-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
