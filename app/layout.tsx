import type { Metadata, Viewport } from 'next';
import { DM_Sans, Newsreader } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import SiteChrome from '@/components/layout/SiteChrome';
import { FREE_SHIPPING_THRESHOLD, SITE_URL, formatPrice } from '@/lib/utils';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const DEFAULT_TITLE = "Vellee Luxe — Premium Men's Shirts";

// Threshold comes from lib/utils so the copy always matches what checkout charges.
const DESCRIPTION = `Discover premium men's shirts crafted for modern India. Shop linen, cotton, and Oxford weave shirts with free shipping over ${formatPrice(FREE_SHIPPING_THRESHOLD)}.`;

// Placeholder until a real 1200x630 image is added at public/og-image.jpg.
const OG_IMAGE = {
  url: 'https://velleeluxe.com/og-image.jpg',
  width: 1200,
  height: 630,
  alt: "Vellee Luxe — Premium Men's Shirts",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | Vellee Luxe',
    default: DEFAULT_TITLE,
  },
  description: DESCRIPTION,
  applicationName: 'Vellee Luxe',
  keywords: [
    "men's shirts",
    'premium shirts India',
    'linen shirts for men',
    'cotton shirts for men',
    'Oxford shirts',
    'luxury menswear India',
    'buy shirts online India',
    'Vellee Luxe',
  ],
  openGraph: {
    siteName: 'Vellee Luxe',
    locale: 'en_IN',
    type: 'website',
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: '#F6F1E8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable}`}>
      <body className="bg-linen font-sans text-ink antialiased">
        <AuthProvider>
          <CartProvider>
            <SiteChrome>{children}</SiteChrome>
          </CartProvider>
        </AuthProvider>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
