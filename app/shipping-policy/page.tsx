import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';
import { getFreeShippingThreshold, getShippingFee } from '@/lib/settings';
import { formatPrice, SUPPORT_EMAIL } from '@/lib/utils';

// Re-render at most once a minute so the shipping amounts follow the admin settings.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const threshold = formatPrice(await getFreeShippingThreshold());
  return {
    title: 'Shipping Policy',
    description: `Vellee Luxe ships across India in 5–7 business days. Free shipping on orders above ${threshold}.`,
    alternates: { canonical: '/shipping-policy' },
  };
}

export default async function ShippingPolicyPage() {
  const [thresholdAmount, shippingFee] = await Promise.all([getFreeShippingThreshold(), getShippingFee()]);
  const threshold = formatPrice(thresholdAmount);

  return (
    <LegalPage
      title="Shipping Policy"
      lastUpdated="30 September 2026"
      intro="We ship to every serviceable pincode in India. Here is what to expect once you place an order."
    >
      <LegalSection title="Delivery time">
        <p>
          Orders are delivered within <strong>5–7 business days</strong> of being placed. Business days are Monday to
          Saturday, excluding public holidays. Remote locations, including parts of the North-East, Jammu &amp; Kashmir,
          Ladakh, and the Andaman &amp; Nicobar and Lakshadweep islands, may take a few days longer.
        </p>
        <p>
          Each item is prepared and quality-checked for your order before dispatch, which is included in the delivery
          time above.
        </p>
      </LegalSection>

      <LegalSection title="Shipping charges">
        <ul>
          <li>
            <strong>Free shipping</strong> on all orders of {threshold} and above.
          </li>
          <li>A flat delivery charge of {formatPrice(shippingFee)} applies to orders below {threshold}.</li>
        </ul>
        <p>The exact charge is shown at checkout before you pay. All prices include applicable taxes.</p>
      </LegalSection>

      <LegalSection title="Order tracking">
        <p>
          Once your order ships, we will email you a confirmation with the courier name and tracking number where
          available. You can also see the status of your orders in{' '}
          <Link href="/account/orders">your account</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Cash on Delivery">
        <p>
          Cash on Delivery is available on most pincodes. Please keep the exact amount ready. Orders refused at the door
          without a valid reason may lose access to Cash on Delivery in future.
        </p>
      </LegalSection>

      <LegalSection title="Delays and failed deliveries">
        <p>
          Occasionally, weather, strikes or courier issues can cause delays beyond our control. If your order has not
          arrived within 10 business days, please write to us and we will follow up with the courier.
        </p>
        <p>
          Please make sure your address, pincode and phone number are correct. If a parcel is returned to us because of
          an incorrect address or repeated failed delivery attempts, we will contact you to arrange re-delivery; an
          additional shipping charge may apply.
        </p>
      </LegalSection>

      <LegalSection title="Damaged parcels">
        <p>
          If your parcel arrives visibly damaged or tampered with, please take a photo and email us within 48 hours of
          delivery so we can make it right.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about your delivery? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order
          number.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
