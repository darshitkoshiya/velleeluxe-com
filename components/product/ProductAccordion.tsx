'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { PlusIcon } from '@/components/ui/Icons';

interface ProductAccordionProps {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section built on <details>, so it works without JavaScript.
 * If the URL hash matches its id (e.g. "#size-guide"), it opens and scrolls into view.
 */
export function ProductAccordion({ id, title, defaultOpen = false, children }: ProductAccordionProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!id) return;
    const openFromHash = () => {
      if (window.location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [id]);

  return (
    <details ref={ref} id={id} open={defaultOpen} className="group scroll-mt-24 border-b border-sand">
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-sans text-xs font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:text-persimmon [&::-webkit-details-marker]:hidden">
        {title}
        <PlusIcon width={16} height={16} className="shrink-0 transition-transform duration-300 group-open:rotate-45" />
      </summary>
      <div className="animate-fade-in pb-6">{children}</div>
    </details>
  );
}

export default ProductAccordion;
