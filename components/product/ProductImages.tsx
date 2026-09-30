'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImagesProps {
  images: string[];
  productName: string;
}

/**
 * Phones: full-width swipe carousel with position dots.
 * Tablet/desktop: large main image with a thumbnail rail.
 */
export function ProductImages({ images, productName }: ProductImagesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLUListElement>(null);
  const active = images[activeIndex] ?? images[0];

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-sand p-10 text-center">
        <p className="font-serif text-lg italic text-slateGrey">Photography coming soon</p>
      </div>
    );
  }

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const goTo = (index: number) => {
    setActiveIndex(index);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Mobile carousel */}
      <div className="relative -mx-4 sm:-mx-6 md:hidden">
        <ul
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Product images"
        >
          {images.map((src, index) => (
            <li key={src} className="relative aspect-[3/4] w-full shrink-0 snap-center bg-sand">
              <Image
                src={src}
                alt={`${productName} — image ${index + 1} of ${images.length}`}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
        {images.length > 1 ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === activeIndex ? 'w-6 bg-ink' : 'w-1.5 bg-ink/30',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Tablet / desktop gallery */}
      <div className="hidden gap-4 md:flex">
        {images.length > 1 ? (
          <ul className="flex w-20 shrink-0 flex-col gap-3" aria-label="Product image thumbnails">
            {images.map((src, index) => (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  className={cn(
                    'relative block aspect-[3/4] w-full overflow-hidden border bg-sand transition-all duration-200',
                    index === activeIndex ? 'border-ink' : 'border-transparent opacity-70 hover:border-pebble hover:opacity-100',
                  )}
                >
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative aspect-[3/4] flex-1 overflow-hidden bg-sand">
          <Image
            key={active}
            src={active}
            alt={`${productName} — image ${activeIndex + 1} of ${images.length}`}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 90vw"
            className="animate-fade-in object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default ProductImages;
