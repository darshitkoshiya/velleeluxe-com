import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { formatPrice, sizeRange } from '@/lib/utils';
import { WishlistButton } from './WishlistButton';

interface ProductCardProps {
  product: Product;
  /** Load the image eagerly (use for cards visible without scrolling). */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [primaryImage, hoverImage] = product.images;
  const soldOut = product.stock === 0;

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
              className="object-cover transition-opacity duration-500"
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
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}

          {/* Subtle hover overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-full bg-linen/90 py-3 text-center font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition-transform duration-300 group-hover:translate-y-0 md:block">
            View Details
          </div>

          {soldOut ? (
            <span className="absolute left-2 top-2 bg-linen px-2 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-ink">
              Sold Out
            </span>
          ) : product.compareAtPrice ? (
            <span className="absolute left-2 top-2 bg-persimmon px-2 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-white">
              Sale
            </span>
          ) : null}
        </div>

        <div className="pt-3">
          <h3 className="font-sans text-[13px] leading-snug text-ink group-hover:text-persimmon">{product.name}</h3>
          <p className="mt-1 flex items-baseline gap-2 font-sans text-[13px]">
            <span className="font-medium text-ink">{formatPrice(product.price)}</span>
            {product.compareAtPrice ? (
              <span className="text-pebble line-through">
                <span className="sr-only">Was </span>
                {formatPrice(product.compareAtPrice)}
              </span>
            ) : null}
          </p>
          {product.sizes.length > 0 ? (
            <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.1em] text-slateGrey">{sizeRange(product.sizes)}</p>
          ) : null}
        </div>
      </Link>

      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute right-1 top-1 h-9 w-9 bg-linen/0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 [&[aria-pressed=true]]:opacity-100"
      />
    </article>
  );
}

export default ProductCard;
