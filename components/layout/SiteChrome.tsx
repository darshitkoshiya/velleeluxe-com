'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { LoginPromptModal } from '@/components/ui/LoginPromptModal';

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdmin) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-linen"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
      <WhatsAppButton />
      <CartDrawer />
      <LoginPromptModal />
    </div>
  );
}
