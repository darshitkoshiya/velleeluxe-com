import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';

export const metadata: Metadata = {
  title: 'Return Policy',
  description:
    'Vellee Luxe offers 7-day size exchanges and store credit on unworn, unwashed items with tags intact. Request it from My Account and we arrange the pickup.',
  alternates: { canonical: '/return-policy' },
};

const SUPPORT_EMAIL = 'hello@velleeluxe.com';

export default function ReturnPolicyPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Vellee Luxe, I need help with a return or exchange.')}`
    : null;

  const whatsappLink = whatsappHref ? (
    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
      WhatsApp
    </a>
  ) : (
    'WhatsApp'
  );

  return (
    <LegalPage
      title="Return Policy"
      lastUpdated="October 2026"
      intro="If a product isn't right, we want to make it right. You can exchange it or receive store credit within 7 days of delivery."
    >
      <LegalSection title="7-day return window">
        <p>
          You may request an exchange or store credit within <strong>7 days of the date your order is delivered</strong>.
          Requests made after this window cannot be accepted.
        </p>
      </LegalSection>

      <LegalSection title="Conditions for return">
        <p>To be eligible, the item must be:</p>
        <ul>
          <li>Unworn and unaltered;</li>
          <li>Unwashed, and free of perfume, deodorant or stains;</li>
          <li>Returned with all original tags intact, in its original packaging where possible.</li>
        </ul>
        <p>Items that do not meet these conditions will be sent back to you, and no exchange or store credit will be issued.</p>
      </LegalSection>

      <LegalSection title="Non-returnable items">
        <ul>
          <li>Items bought on sale or with a clearance discount;</li>
          <li>Customised or made-to-measure items.</li>
        </ul>
        <p>These items can only be returned if they arrive damaged, defective or are not what you ordered.</p>
      </LegalSection>

      <LegalSection title="How to return">
        <ol>
          <li>
            <strong>Open your order in My Account</strong> within 7 days of delivery and tap &ldquo;Return or
            Exchange&rdquo; on the item.
          </li>
          <li>
            <strong>Tell us why:</strong> the size doesn&rsquo;t fit, you received the wrong item, or the item is damaged
            or defective.
          </li>
          <li>
            <strong>We arrange a free pickup</strong> from your delivery address, usually within 2–3 working days. Please
            keep the item packed and ready.
          </li>
          <li>
            <strong>We inspect the item</strong> once it reaches us, then dispatch your exchange or add store credit to
            your account.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Size exchange">
        <ol>
          <li>
            <strong>Select your new size.</strong> We show only the sizes currently in stock. If your size is available,
            confirm the exchange.
          </li>
          <li>
            <strong>If your size is not in stock</strong>, tap &ldquo;My size is not available&rdquo; and we will issue
            store credit for the full item value once the returned item passes inspection.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Damaged, defective or wrong items">
        <p>
          If your order arrives damaged, defective or incorrect, raise a request from My Account within 7 days of
          delivery and upload clear photos of the issue. Photos are checked automatically against your order; some
          requests are reviewed by our team. Once the item is received and inspected, we send a replacement in the same
          size (subject to availability) or issue store credit for the full item value.
        </p>
      </LegalSection>

      <LegalSection title="Store credit">
        <p>
          Store credit is added to your Vellee Luxe account after the returned item is received and inspected. It never
          expires and can be used on any future order on velleeluxe.com.
        </p>
      </LegalSection>

      <LegalSection title="No cash refunds">
        <p>
          We do not offer cash or bank refunds for returned items, including Cash on Delivery orders. Every eligible
          return is resolved with an exchange or store credit. Original shipping charges are non-refundable.
        </p>
      </LegalSection>

      <LegalSection title="Need help?">
        <p>
          Message us on {whatsappLink} or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order
          number. See also our <Link href="/shipping-policy">Shipping Policy</Link> and{' '}
          <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
