'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { CloseIcon, MinusIcon, PlusIcon } from '@/components/ui/Icons';
import type { CartItem as CartItemType } from '@/lib/types';
import { cn, formatPrice, MAX_QUANTITY_PER_ITEM, titleCase } from '@/lib/utils';

interface CartItemProps {
  item: CartItemType;
  /** "compact" = 80×107 image (drawer), "large" = 96×128 image (cart page). */
  variant?: 'compact' | 'large';
  onNavigate?: () => void;
}

export function CartItem({ item, variant = 'compact', onNavigate }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const { product, size, quantity } = item;
  const image = product.images[0];
  const large = variant === 'large';

  const qtyButton =
    'inline-flex h-8 w-8 items-center justify-center text-ink transition-colors hover:text-persimmon disabled:text-pebble disabled:hover:text-pebble';

  return (
    <li className="flex gap-4 border-b border-sand py-5 last:border-b-0">
      <Link
        href={`/product/${product.slug}`}
        onClick={onNavigate}
        className={cn('relative shrink-0 overflow-hidden bg-sand', large ? 'h-32 w-24' : 'h-[107px] w-20')}
      >
        {image ? (
          <Image src={image} alt={product.name} fill sizes={large ? '96px' : '80px'} className="object-cover" />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${product.slug}`}
              onClick={onNavigate}
              className={cn('block font-sans text-ink hover:text-persimmon', large ? 'text-sm' : 'text-[13px]')}
            >
              {product.name}
            </Link>
            <p className="mt-1 font-sans text-xs text-slateGrey">
              {product.colour ? <>{titleCase(product.colour)} <span aria-hidden="true">/</span> </> : null}
              Size {size}
            </p>
            {!large ? <p className="mt-1 font-sans text-xs text-slateGrey">{formatPrice(product.price)} each</p> : null}
          </div>
          <button
            type="button"
            onClick={() => removeItem(product.id, size)}
            className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-slateGrey hover:text-persimmon"
            aria-label={`Remove ${product.name} (size ${size}) from cart`}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="inline-flex items-center border border-sand" role="group" aria-label={`Quantity for ${product.name}`}>
            <button
              type="button"
              className={qtyButton}
              onClick={() => updateQuantity(product.id, size, quantity - 1)}
              aria-label="Decrease quantity"
            >
              <MinusIcon width={14} height={14} />
            </button>
            <span className="w-8 text-center font-sans text-sm" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className={qtyButton}
              onClick={() => updateQuantity(product.id, size, quantity + 1)}
              disabled={quantity >= MAX_QUANTITY_PER_ITEM}
              aria-label="Increase quantity"
            >
              <PlusIcon width={14} height={14} />
            </button>
          </div>
          <p className="font-sans text-sm font-medium text-ink">{formatPrice(product.price * quantity)}</p>
        </div>
      </div>
    </li>
  );
}

export default CartItem;
