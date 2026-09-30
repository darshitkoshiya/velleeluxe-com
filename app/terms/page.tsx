import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';
const SUPPORT_EMAIL = 'hello@velleeluxe.com';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms and conditions for shopping at velleeluxe.com.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      lastUpdated="October 2026"
      intro="These terms apply when you browse or buy from velleeluxe.com. By using the site or placing an order, you agree to them."
    >
      <LegalSection title="About us">
        <p>
          velleeluxe.com is operated by Vellee Luxe, an online retailer of men&rsquo;s clothing based in India. You can
          contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility and accounts">
        <p>
          You must be at least 18 years old, or use the site under the supervision of a parent or guardian, to place an
          order. If you create an account, you are responsible for keeping your login details confidential and for all
          activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="Use of the website">
        <p>
          You may use this website to browse our products and place orders for personal, non-commercial use. We may
          update, suspend or withdraw any part of the site at any time, and we do not guarantee that it will always be
          available or error-free.
        </p>
      </LegalSection>

      <LegalSection title="Product descriptions">
        <p>
          We take care to describe and photograph every product accurately, including its fabric, fit and measurements.
          However, colours can look different on different screens, and natural fabrics such as linen may show slight
          variations in texture and shade — these are part of the character of the cloth, not defects. If a product you
          receive is materially different from its description, you may return it under our{' '}
          <Link href="/return-policy">Return Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Pricing">
        <ul>
          <li>All prices are listed in Indian Rupees (₹ INR) only and are inclusive of GST.</li>
          <li>
            We may change prices or discontinue products at any time. The price you pay is the price shown at checkout
            when you place your order.
          </li>
          <li>
            If a product is listed at an obviously incorrect price because of an error, we may cancel the order and
            refund any amount paid in full.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Order acceptance and cancellation">
        <p>
          Placing an order is an offer to buy. We accept your order when we send an order confirmation email. We may
          decline or cancel an order — for example, if an item becomes unavailable, if we cannot verify payment, or if we
          suspect fraud — in which case any payment made will be refunded in full to the original payment method.
        </p>
        <p>
          You can cancel your order free of charge at any time before it is shipped by writing to us with your order
          number. Once an order has shipped, it can no longer be cancelled, but you may return it under our{' '}
          <Link href="/return-policy">Return Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Payment">
        <p>
          We accept online payments through Razorpay (UPI, cards, net banking and wallets) and Cash on Delivery on
          eligible pincodes. Online payments are processed securely by Razorpay; we do not store your card or bank
          details.
        </p>
      </LegalSection>

      <LegalSection title="Shipping, returns and refunds">
        <p>
          Delivery is governed by our <Link href="/shipping-policy">Shipping Policy</Link>. Returns, exchanges and refunds
          are governed by our <Link href="/return-policy">Return Policy</Link>. Both form part of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          All content on this site — including the Vellee Luxe name, text, photographs and design — belongs to Vellee
          Luxe or its licensors. You may not copy, reproduce or use it for commercial purposes without our written
          permission.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You agree not to misuse the site: for example, by attempting to gain unauthorised access, interfering with its
          operation, placing fraudulent orders, or using it for any unlawful purpose.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, our total liability for any claim relating to an order is limited to
          the amount you paid for that order. We are not liable for indirect or consequential losses. Nothing in these
          terms limits your rights as a consumer under the Consumer Protection Act, 2019.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          How we handle your personal information is explained in our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Governing law and disputes">
        <p>
          These terms are governed by the laws of India. We will always try to resolve concerns directly first — please
          write to us. Any dispute that cannot be resolved amicably is subject to the exclusive jurisdiction of the
          competent courts in Gujarat, India, without prejudice to your right to approach a consumer commission under the
          Consumer Protection Act, 2019.
        </p>
      </LegalSection>

      <LegalSection title="Grievance redressal">
        <p>
          In accordance with the Consumer Protection (E-Commerce) Rules, 2020, complaints may be sent to our Grievance
          Officer at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We acknowledge complaints within 48 hours and
          aim to resolve them within one month.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. The version in force when you place an order applies to that
          order.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
