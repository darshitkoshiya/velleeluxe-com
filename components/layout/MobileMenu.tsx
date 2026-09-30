'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOverlay } from '@/hooks/useOverlay';
import { CloseIcon, HeartIcon, MinusIcon, PlusIcon, UserIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { isActivePath, isNavGroup, type NavEntry, type NavGroup } from './navigation';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  entries: NavEntry[];
}

const bigLink = 'block py-3 font-sans text-xl text-ink transition-colors hover:text-accent';

function Accordion({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `mobile-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(bigLink, 'flex w-full items-center justify-between text-left')}
      >
        {group.label}
        {expanded ? <MinusIcon width={18} height={18} /> : <PlusIcon width={18} height={18} />}
      </button>
      {expanded ? (
        <ul id={panelId} className="mb-2 border-l border-sand pl-4">
          {group.items.length === 0 ? (
            <li className="py-2 font-sans text-sm italic text-ink-muted">Coming soon</li>
          ) : (
            group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className="block py-2 font-sans text-base text-ink-muted transition-colors hover:text-ink"
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

export default function MobileMenu({ open, onClose, entries }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? '';
  const { user } = useAuth();

  useOverlay(open, onClose, panelRef);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[60] flex animate-slide-in-left flex-col bg-linen lg:hidden"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sand px-4">
        <span className="font-sans text-[15px] font-semibold uppercase tracking-[0.15em] text-ink">Vellee Luxe</span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-ink transition-colors hover:text-accent"
          aria-label="Close menu"
          data-autofocus
        >
          <CloseIcon width={24} height={24} />
        </button>
      </div>

      <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 py-6">
        <ul className="divide-y divide-sand">
          {entries.map((entry) => (
            <li key={entry.label}>
              {isNavGroup(entry) ? (
                <Accordion group={entry} onNavigate={onClose} />
              ) : (
                <Link
                  href={entry.href}
                  onClick={onClose}
                  aria-current={isActivePath(pathname, entry.href) ? 'page' : undefined}
                  className={bigLink}
                >
                  {entry.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sand px-6 py-5">
        <ul className="flex items-center gap-8">
          <li>
            <Link
              href="/account/wishlist"
              onClick={onClose}
              className="inline-flex items-center gap-2 font-sans text-[13px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink"
            >
              <HeartIcon width={18} height={18} />
              Wishlist
            </Link>
          </li>
          <li>
            <Link
              href={user ? '/account/orders' : '/account/login'}
              onClick={onClose}
              className="inline-flex items-center gap-2 font-sans text-[13px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink"
            >
              <UserIcon width={18} height={18} />
              {user ? 'Account' : 'Sign In'}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
