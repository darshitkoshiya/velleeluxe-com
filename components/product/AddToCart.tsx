'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/lib/types';
import { cn, formatPrice, titleCase } from '@/lib/utils';
import { ColourSwatch } from './ColourSwatch';
import { SizeSelector } from './SizeSelector';
import { WishlistButton } from './WishlistButton';

/**
 * Colour, size selection, Add to Bag and wishlist for the product page.
 * On phones a sticky "Add to Bag" bar appears once the main button scrolls out of view.
 */
export function AddToCart({ product }: { product: Product }) {
  const { addItem, openDrawer } = useCart();
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [error, setError] = useState<string | undefined>();
  const [showStickyBar, setShowStickyBar] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);
  const soldOut = product.stock === 0;
  const lowStock = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5;

  useEffect(() => {
    const target = buttonRowRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      // Show only after the main button has scrolled up past the top of the screen.
      setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleAdd = (fromStickyBar = false) => {
    if (!size) {
      setError('Please select a size.');
      if (fromStickyBar) selectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    addItem(product, size, 1);
    openDrawer();
  };

  return (
    <>
      <div className="space-y-6">
        {product.colour ? (
          <div>
            <p className="label-caps mb-3 text-ink">
              Colour <span className="ml-1 font-normal normal-case tracking-normal text-slateGrey">{titleCase(product.colour)}</span>
            </p>
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink"
              aria-label={`Colour: ${titleCase(product.colour)}`}
              role="img"
            >
              <ColourSwatch colour={product.colour} size="md" />
            </span>
          </div>
        ) : null}

        {product.sizes.length > 0 ? (
          <div ref={selectorRef} className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between">
              <span className="label-caps text-ink">
                Size
                {size ? <span className="ml-2 font-normal normal-case tracking-normal text-slateGrey">{size}</span> : null}
              </span>
              <a
                href="#size-guide"
                className="font-sans text-xs text-slateGrey underline underline-offset-4 hover:text-persimmon"
              >
                Size guide
              </a>
            </div>
            <SizeSelector
              sizes={product.sizes}
              selected={size}
              onSelect={(value) => {
                setSize(value);
                setError(undefined);
              }}
              disabledSizes={soldOut ? product.sizes : []}
              error={error}
            />
          </div>
        ) : null}

        {lowStock ? (
          <p className="font-sans text-xs text-persimmon">Only {product.stock} left — order soon.</p>
        ) : null}

        <div ref={buttonRowRef} className="flex items-stretch gap-3">
          <Button variant="primary" size="lg" width="full" onClick={() => handleAdd()} disabled={soldOut}>
            {soldOut ? 'Sold Out' : 'Add to Bag'}
          </Button>
          <WishlistButton
            product={product}
            className="h-14 w-14 shrink-0 rounded-sm border border-sand hover:border-ink"
          />
        </div>
      </div>

      {/* Sticky mobile bar. Right padding leaves room for the floating WhatsApp button. */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-linen/95 backdrop-blur transition-transform duration-300 ease-out md:hidden',
          showStickyBar ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
        aria-hidden={!showStickyBar}
      >
        <div className="flex items-center gap-3 py-3 pl-4 pr-24">
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-xs text-ink">{product.name}</p>
            <p className="font-sans text-sm font-medium text-ink">
              {formatPrice(product.price)}
              {size ? <span className="ml-2 text-xs font-normal text-slateGrey">Size {size}</span> : null}
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            width="auto"
            onClick={() => handleAdd(true)}
            disabled={soldOut}
            tabIndex={showStickyBar ? 0 : -1}
            className="shrink-0"
          >
            {soldOut ? 'Sold Out' : size ? 'Add to Bag' : 'Select Size'}
          </Button>
        </div>
      </div>
    </>
  );
}

export default AddToCart;
