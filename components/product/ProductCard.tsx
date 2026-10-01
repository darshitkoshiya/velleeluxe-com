import Image from 'next/image';
import Link from 'next/link';
import type { ColourVariant, Product } from '@/lib/types';
import { cn, displayPrice, formatPrice, isProductOutOfStock, sizeRange } from '@/lib/utils';
import { ColourSwatch } from './ColourSwatch';
import { WishlistButton } from './WishlistButton';

/** Products added within this many days get the "New" badge. */
const NEW_WINDOW_DAYS = 30;

interface ProductCardProps {
  product: Product;
  /** Load the image eagerly (use for cards visible without scrolling). */
  priority?: boolean;
  /** Show the "Best Seller" badge. */
  bestSeller?: boolean;
  /** All colours of this product's design (including itself). Dots shown when 2+. */
  colourVariants?: ColourVariant[];
}

type BadgeKind = 'soldOut' | 'sale' | 'new' | 'bestSeller';

export function isNewProduct(product: Product): boolean {
  const created = Date.parse(product.createdAt);
  if (!created) return false;
  return Date.now() - created < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function getBadges(product: Product, bestSeller: boolean): BadgeKind[] {
  if (isProductOutOfStock(product)) return ['soldOut'];
  const badges: BadgeKind[] = [];
  if (product.compareAtPrice) badges.push('sale');
  if (isNewProduct(product)) badges.push('new');
  if (bestSeller) badges.push('bestSeller');
  return badges.slice(0, 2);
}

const BADGE_LABEL: Record<BadgeKind, string> = {
  soldOut: 'Sold Out',
  sale: 'Sale',
  new: 'New',
  bestSeller: 'Best Seller',
};

const BADGE_CLASS: Record<BadgeKind, string> = {
  soldOut: 'bg-linen text-ink',
  sale: 'bg-persimmon text-white',
  new: 'bg-ink text-linen',
  bestSeller: 'bg-linen text-ink',
};

export function ProductCard({ product, priority = false, bestSeller = false, colourVariants }: ProductCardProps) {
  const [primaryImage, hoverImage] = product.images;
  const soldOut = isProductOutOfStock(product);
  const badges = getBadges(product, bestSeller);
  // Out of stock: show MRP only — no strike-through, no discount.
  const showCompareAt = !soldOut && Boolean(product.compareAtPrice);
  const discount =
    showCompareAt && product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  return (
    <article className="group relative">
      <Link href={`/product/${product.slug}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[3/4] overflow-hidden bg-sand">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                'object-cover transition-all duration-700 ease-out group-hover:scale-[1.03]',
                hoverImage && 'md:group-hover:opacity-0',
                soldOut && 'opacity-70',
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center font-serif text-sm italic text-slateGrey">
              {product.name}
            </div>
          )}
          {hoverImage ? (
            <Image
              src={hoverImage}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="hidden scale-[1.03] object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100 md:block"
            />
          ) : null}

          {/* Hover bar (desktop) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-full bg-linen/95 py-3 text-center font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition-transform duration-300 ease-out group-hover:translate-y-0 md:block">
            {soldOut ? 'Sold Out' : 'View Details'}
          </div>

          {badges.length > 0 ? (
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className={cn(
                    'px-2 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em]',
                    BADGE_CLASS[badge],
                  )}
                >
                  {BADGE_LABEL[badge]}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pt-3">
          <h3 className="font-sans text-[13px] leading-snug text-ink transition-colors group-hover:text-persimmon">
            {product.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-sans text-[13px]">
            <span className="font-medium text-ink">{formatPrice(displayPrice(product))}</span>
            {showCompareAt && product.compareAtPrice ? (
              <>
                <span className="text-pebble line-through">
                  <span className="sr-only">Was </span>
                  {formatPrice(product.compareAtPrice)}
                </span>
                {discount > 0 ? <span className="text-[11px] text-persimmon">{discount}% off</span> : null}
              </>
            ) : null}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {colourVariants && colourVariants.length > 1 ? (
                colourVariants.map((v) => (
                  <ColourSwatch
                    key={v.slug}
                    colour={v.colour}
                    size="sm"
                    className={v.slug === product.slug ? 'opacity-100' : 'opacity-50'}
                  />
                ))
              ) : product.colour ? (
                <ColourSwatch colour={product.colour} showLabel />
              ) : null}
            </div>
            {product.sizes.length > 0 ? (
              <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-slateGrey">
                {sizeRange(product.sizes)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <WishlistButton
        product={product}
        className="absolute right-1 top-1 h-9 w-9 bg-linen/0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 [&[aria-pressed=true]]:opacity-100"
      />
    </article>
  );
}

export default ProductCard;
