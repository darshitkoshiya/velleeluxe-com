import type { Metadata, Viewport } from 'next';
import { DM_Sans, Newsreader } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import SiteChrome from '@/components/layout/SiteChrome';
import { SITE_URL } from '@/lib/utils';
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

const DESCRIPTION =
  'Premium quality shirts crafted for the modern Indian man. Shop linen, cotton and formal shirts at Vellee Luxe.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | Vellee Luxe',
    default: 'Vellee Luxe — Premium Shirts for Modern India',
  },
  description: DESCRIPTION,
  applicationName: 'Vellee Luxe',
  openGraph: {
    siteName: 'Vellee Luxe',
    locale: 'en_IN',
    type: 'website',
    url: SITE_URL,
    title: 'Vellee Luxe — Premium Shirts for Modern India',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vellee Luxe — Premium Shirts for Modern India',
    description: DESCRIPTION,
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
