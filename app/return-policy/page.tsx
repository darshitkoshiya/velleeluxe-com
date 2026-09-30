import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';

export const metadata: Metadata = {
  title: 'Return Policy',
  description:
    'Vellee Luxe offers 7-day returns and exchanges on unworn, unwashed shirts with tags intact. Message us on WhatsApp and we arrange the pickup.',
  alternates: { canonical: '/return-policy' },
};

const SUPPORT_EMAIL = 'hello@velleeluxe.com';

export default function ReturnPolicyPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Vellee Luxe, I would like to return or exchange an order.')}`
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
      intro="If a shirt isn't right, we want to make it right. You can return or exchange it within 7 days of delivery."
    >
      <LegalSection title="7-day return window">
        <p>
          You may request a return or exchange within <strong>7 days of the date your order is delivered</strong>.
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
        <p>Items that do not meet these conditions will be sent back to you and no refund will be issued.</p>
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
            <strong>Message us on {whatsappLink}</strong> within 7 days of delivery with your order number, the item(s)
            you want to return and the reason. You can also email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </li>
          <li>
            <strong>We arrange a pickup</strong> from your delivery address, usually within 2–3 working days. Please
            keep the item packed and ready.
          </li>
          <li>
            <strong>We inspect the item</strong> once it reaches us, and confirm your refund or exchange.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Exchanges">
        <p>
          Need a different size? Follow the same steps above and tell us the size you would like. Size exchanges are free,
          subject to availability. Once we receive the original item, we ship your replacement right away. If the size
          you need is unavailable, we will issue a full refund instead.
        </p>
      </LegalSection>

      <LegalSection title="Refund timeline">
        <ul>
          <li>
            <strong>Online payments:</strong> refunded to your original payment method within 5–7 business days of the
            return passing inspection. Your bank may take a few additional days to show it.
          </li>
          <li>
            <strong>Cash on Delivery orders:</strong> refunded by UPI or bank transfer (NEFT/IMPS) to an account you
            share with us, within 5–7 business days of the return passing inspection.
          </li>
        </ul>
        <p>
          Original shipping charges are non-refundable, except where the item was damaged, defective or not what you
          ordered.
        </p>
      </LegalSection>

      <LegalSection title="Damaged, defective or wrong items">
        <p>
          If your order arrives damaged, defective or incorrect, message us on {whatsappLink} with photos within 48 hours
          of delivery. We will arrange a free pickup and send a replacement or issue a full refund, including shipping.
        </p>
      </LegalSection>

      <LegalSection title="More information">
        <p>
          See also our <Link href="/shipping-policy">Shipping Policy</Link> and{' '}
          <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
