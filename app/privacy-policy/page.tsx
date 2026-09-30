import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/layout/LegalPage';
import { SUPPORT_EMAIL } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Vellee Luxe collects, uses and protects your personal information.',
  alternates: { canonical: '/privacy-policy' },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="30 September 2026"
      intro="Your privacy matters to us. This policy explains what personal information we collect when you use velleeluxe.com, why we collect it, and the choices you have."
    >
      <LegalSection title="Who we are">
        <p>
          Vellee Luxe (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the online store at velleeluxe.com
          and is the data fiduciary / data controller for the personal information described in this policy. This policy
          is published in accordance with the Information Technology Act, 2000, the Information Technology (Reasonable
          Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital
          Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;). Where the EU General Data Protection Regulation
          (&ldquo;GDPR&rdquo;) applies to you, we also honour the rights it gives you.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address and password (stored securely by our
            authentication provider — we never see your password), or basic profile details if you sign in with Google.
          </li>
          <li>
            <strong>Order information:</strong> your name, email, phone number, shipping address, items ordered and order
            history.
          </li>
          <li>
            <strong>Payment information:</strong> payments are processed by Razorpay. We do not receive or store your
            card number, UPI PIN, CVV or banking passwords. We keep only a payment reference ID.
          </li>
          <li>
            <strong>Communications:</strong> messages you send us through the contact form or by email.
          </li>
          <li>
            <strong>Device and usage data:</strong> your cart and wishlist may be saved in your browser&rsquo;s local
            storage. Our hosting provider may log basic technical information such as IP address and browser type for
            security.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use your information">
        <ul>
          <li>To process, fulfil and deliver your orders, and to handle returns and refunds;</li>
          <li>To send order confirmations, shipping updates and replies to your questions;</li>
          <li>To maintain your account, order history and wishlist;</li>
          <li>To prevent fraud and keep our store secure;</li>
          <li>To comply with legal, tax and accounting obligations.</li>
        </ul>
        <p>
          We process your information on the basis of your consent, to perform our contract with you when you place an
          order, and to meet our legal obligations. We do not send marketing emails unless you have opted in, and we do
          not sell your personal information.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>We share personal information only with service providers who help us run the store, and only as needed:</p>
        <ul>
          <li>Google Firebase and Google Workspace (accounts, order records);</li>
          <li>Razorpay (payment processing);</li>
          <li>Resend (transactional email delivery);</li>
          <li>Courier and logistics partners (to deliver your order);</li>
          <li>Our hosting provider (to serve the website).</li>
        </ul>
        <p>
          Some of these providers may store data on servers outside India. Where they do, we rely on their contractual
          commitments to protect your information. We may also disclose information where required by law or to protect
          our legal rights.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep order records for as long as required under Indian tax and accounting laws (generally up to 8 years).
          Account information is kept while your account is active. You can ask us to delete your account at any time,
          subject to these legal retention requirements.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Subject to applicable law, you have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you and obtain a summary of how it is processed;</li>
          <li>Correct, complete or update inaccurate information;</li>
          <li>Request erasure of your information;</li>
          <li>Withdraw consent at any time (this does not affect processing already carried out);</li>
          <li>Nominate another person to exercise your rights in the event of death or incapacity;</li>
          <li>Raise a grievance with us, and escalate it to the Data Protection Board of India if unresolved.</li>
        </ul>
        <p>
          To exercise any of these rights, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will respond
          within 30 days.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use industry-standard safeguards, including encrypted connections (HTTPS), access controls and reputable
          infrastructure providers, to protect your information. No system is completely secure, but we work to protect
          your data and will notify you and the relevant authorities of any breach as required by law.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          We use essential browser storage to keep you signed in and remember your cart and wishlist. We do not use
          advertising cookies. You can clear this storage in your browser settings at any time.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Our store is intended for adults. We do not knowingly collect personal information from anyone under 18 without
          verifiable parental consent.
        </p>
      </LegalSection>

      <LegalSection title="Grievance Officer">
        <p>
          In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020,
          you may contact our Grievance Officer at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will
          acknowledge your complaint within 48 hours and resolve it within one month.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. The &ldquo;last updated&rdquo; date above shows when it last
          changed. Significant changes will be highlighted on this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
