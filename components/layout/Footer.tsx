'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentType } from 'react';

/** Mirrors SocialLinks in lib/settings.ts (set in the admin panel, served by /api/settings). */
type SocialLinks = {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  pinterest: string;
};

const shopLinks = [
  { href: '/shop', label: 'Shop All' },
  { href: '/new-arrival', label: 'New Arrival' },
  { href: '/best-sellers', label: 'Best Sellers' },
  { href: '/sale', label: 'Sale' },
  { href: '/size-guide', label: 'Size Guide' },
  { href: '/about', label: 'About Us' },
];

const helpLinks = [
  { href: '/return-policy', label: 'Exchange Policy' },
  { href: '/shipping-policy', label: 'Shipping Policy' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/contact', label: 'Contact Us' },
];

const heading = 'mb-3 font-sans text-xs uppercase tracking-widest text-oxford';
const linkClass = 'font-sans text-sm text-pebble transition-colors hover:text-linen';
const socialClass =
  'inline-flex h-10 w-10 items-center justify-center border border-[#2A3347] text-pebble transition-colors hover:border-pebble hover:text-linen';

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" fill="currentColor" />
    </svg>
  );
}

function PinterestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M11 13c-.6 2.6-1.1 5.3-2 7.5" />
      <path d="M10.2 14.3C9.5 13.6 9 12.7 9 11.5 9 9 10.8 7 13.2 7c2.2 0 3.8 1.5 3.8 3.7 0 2.6-1.3 4.6-3.2 4.6-1 0-1.8-.8-1.6-1.8l.7-2.9" />
    </svg>
  );
}

const SOCIAL_PLATFORMS: { key: keyof SocialLinks; label: string; Icon: ComponentType }[] = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { key: 'twitter', label: 'X', Icon: XIcon },
  { key: 'youtube', label: 'YouTube', Icon: YouTubeIcon },
  { key: 'pinterest', label: 'Pinterest', Icon: PinterestIcon },
];

/** Only http(s) links are rendered, so a bad value can never become a javascript: URL. */
function isSafeUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className={heading}>{title}</h2>
      <ul className="space-y-2.5">
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Footer() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : '#';
  const [socialLinks, setSocialLinks] = useState<Partial<SocialLinks>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { socialLinks?: Partial<SocialLinks> } | null) => {
        if (!cancelled && data?.socialLinks && typeof data.socialLinks === 'object') {
          setSocialLinks(data.socialLinks);
        }
      })
      .catch(() => {
        // Footer still renders without social icons if settings can't load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSocial = SOCIAL_PLATFORMS.filter(({ key }) => isSafeUrl(socialLinks[key]));

  return (
    <footer className="bg-ink text-linen">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-8 md:grid-cols-3 lg:px-16">
        <div>
          <Link href="/" className="font-sans font-semibold uppercase tracking-[0.15em] text-linen">
            Vellee Luxe
          </Link>
          <p className="mt-2 font-serif text-sm italic text-sand">Premium shirts for modern India.</p>
          <div className="mt-6 flex items-center gap-3">
            {activeSocial.map(({ key, label, Icon }) => (
              <a
                key={key}
                href={(socialLinks[key] as string).trim()}
                className={socialClass}
                aria-label={`Vellee Luxe on ${label}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon />
              </a>
            ))}
            <a href={whatsappHref} className={socialClass} aria-label="Chat with Vellee Luxe on WhatsApp" target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <LinkColumn title="Shop" links={shopLinks} />
        <LinkColumn title="Help" links={helpLinks} />
      </div>

      <div className="border-t border-[#2A3347] px-4 py-4 text-center font-sans text-xs text-pebble">
        &copy; 2026 Vellee Luxe. All rights reserved.
      </div>
    </footer>
  );
}
