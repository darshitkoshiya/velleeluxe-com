import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';
import { SUPPORT_EMAIL } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Return Policy',
  description: 'Vellee Luxe offers 7-day returns and exchanges on unworn shirts with original tags attached.',
  alternates: { canonical: '/return-policy' },
};

export default function ReturnPolicyPage() {
  return (
    <LegalPage
      title="Return Policy"
      lastUpdated="30 September 2026"
      intro="If a shirt isn't right, we want to make it right. You can return or exchange it within 7 days of delivery."
    >
      <LegalSection title="Eligibility">
        <p>You may return or exchange an item within 7 days of delivery, provided that:</p>
        <ul>
          <li>It is unworn, unwashed and unaltered;</li>
          <li>All original tags are still attached;</li>
          <li>It is returned in its original packaging, where possible.</li>
        </ul>
        <p>
          Items that show signs of wear, washing, perfume, stains or damage not present at delivery cannot be accepted.
        </p>
      </LegalSection>

      <LegalSection title="How to request a return or exchange">
        <ol>
          <li>
            Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 7 days of delivery with your order
            number, the item(s) you want to return, and the reason. For exchanges, tell us the size you need.
          </li>
          <li>We will confirm your request within 24 hours and share pickup or return-shipping details.</li>
          <li>Once the item reaches us and passes a quality check, we will process your refund or send your exchange.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Exchanges">
        <p>
          Size exchanges are free, subject to availability. If the size you need is unavailable, we will offer a full
          refund instead.
        </p>
      </LegalSection>

      <LegalSection title="Refunds">
        <ul>
          <li>
            <strong>Online payments:</strong> refunded to the original payment method within 5–7 business days after
            the return is approved. Your bank may take a few additional days to reflect it.
          </li>
          <li>
            <strong>Cash on Delivery orders:</strong> refunded by bank transfer (NEFT/IMPS) or UPI to an account you
            provide, within 5–7 business days after the return is approved.
          </li>
        </ul>
        <p>
          Original shipping charges are non-refundable, except where the item was defective, damaged or not what you
          ordered.
        </p>
      </LegalSection>

      <LegalSection title="Damaged, defective or wrong items">
        <p>
          If you receive a damaged or defective item, or the wrong item, please email us with photos within 48 hours of
          delivery. We will arrange a free pickup and send a replacement or issue a full refund, including shipping.
        </p>
      </LegalSection>

      <LegalSection title="Cancellations">
        <p>
          You can cancel an order free of charge before it ships by emailing us with your order number. Once an order has
          shipped, please follow the return process above.
        </p>
      </LegalSection>

      <LegalSection title="More information">
        <p>
          See also our <Link href="/shipping-policy">Shipping Policy</Link> and <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
