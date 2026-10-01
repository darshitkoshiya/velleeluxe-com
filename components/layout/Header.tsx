'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { BagIcon, HeartIcon, MenuIcon, UserIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import MobileMenu from './MobileMenu';
import { buildNavEntries, isActivePath, isNavGroup, type NavGroup, type NavItem, type ShopFilterLinks } from './navigation';

const CLOSE_DELAY_MS = 150;

const iconButton =
  'relative inline-flex h-10 w-10 items-center justify-center text-ink transition-colors hover:text-accent';

const navLink = 'font-sans text-[13px] uppercase tracking-[0.08em] transition-colors hover:text-ink';

function CartButton({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={cn(iconButton, className)}
      onClick={onClick}
      aria-label={`Open cart, ${count} ${count === 1 ? 'item' : 'items'}`}
    >
      <BagIcon width={22} height={22} />
      <span className="absolute right-0 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-sans text-[10px] font-medium leading-none text-white">
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = `nav-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const show = () => {
    clearTimer();
    setOpen(true);
  };

  const hide = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => {
    const pending = timer;
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className={cn(navLink, 'inline-flex h-full items-center gap-1.5', open ? 'text-ink' : 'text-ink-muted')}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {group.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')}>
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul
          id={menuId}
          className="absolute left-1/2 top-full min-w-48 -translate-x-1/2 border border-sand bg-linen py-2 shadow-md"
        >
          {group.items.length === 0 ? (
            <li className="whitespace-nowrap px-5 py-2 font-sans text-[12px] italic text-ink-muted">Coming soon</li>
          ) : (
            group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block whitespace-nowrap px-5 py-2 font-sans text-[13px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

const NO_LINKS: NavItem[] = [];

export default function Header({ fabricLinks = NO_LINKS, patternLinks = NO_LINKS }: ShopFilterLinks = {}) {
  const pathname = usePathname() ?? '';
  const navEntries = useMemo(() => buildNavEntries({ fabricLinks, patternLinks }), [fabricLinks, patternLinks]);
  const { totalItems, hydrated, openDrawer } = useCart();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const count = hydrated ? totalItems : 0;
  const accountHref = user ? '/account/orders' : '/account/login';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 w-full border-b border-sand bg-linen">
        <div className="mx-auto hidden h-full max-w-7xl items-center gap-6 px-6 lg:flex xl:px-10">
          <div className="flex flex-1 items-center">
            <Link
              href="/"
              className="whitespace-nowrap font-sans text-[15px] font-semibold uppercase tracking-[0.15em] text-ink xl:text-base"
            >
              Vellee Luxe
            </Link>
          </div>

          <nav aria-label="Main" className="h-full">
            <ul className="flex h-full items-center gap-5 whitespace-nowrap xl:gap-8">
              {navEntries.map((entry) => (
                <li key={entry.label} className="h-full flex items-center">
                  {isNavGroup(entry) ? (
                    <NavDropdown group={entry} pathname={pathname} />
                  ) : (
                    <Link
                      href={entry.href}
                      aria-current={isActivePath(pathname, entry.href) ? 'page' : undefined}
                      className={cn(navLink, 'inline-flex h-full items-center', isActivePath(pathname, entry.href) ? 'text-ink' : 'text-ink-muted')}
                    >
                      {entry.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="-mr-2 flex flex-1 items-center justify-end gap-1">
            <Link href="/account/wishlist" className={iconButton} aria-label="Wishlist">
              <HeartIcon width={22} height={22} />
            </Link>
            <CartButton count={count} onClick={openDrawer} />
            <Link href={accountHref} className={iconButton} aria-label={user ? 'Your account' : 'Sign in'}>
              <UserIcon width={22} height={22} />
            </Link>
          </div>
        </div>

        <div className="relative flex h-full items-center justify-between px-2 lg:hidden">
          <button
            type="button"
            className={iconButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <MenuIcon width={24} height={24} />
          </button>
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[15px] font-semibold uppercase tracking-[0.15em] text-ink"
          >
            Vellee Luxe
          </Link>
          <CartButton count={count} onClick={openDrawer} />
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={closeMenu} entries={navEntries} />
    </>
  );
}
