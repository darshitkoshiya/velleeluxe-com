'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImagesProps {
  images: string[];
  productName: string;
}

export function ProductImages({ images, productName }: ProductImagesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-sand p-10 text-center">
        <p className="font-serif text-lg italic text-slateGrey">Photography coming soon</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand">
        <Image
          key={active}
          src={active}
          alt={`${productName} — image ${activeIndex + 1} of ${images.length}`}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="animate-fade-in object-cover"
        />
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:gap-3" aria-label="Product images">
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={cn(
                  'relative block aspect-[3/4] w-full overflow-hidden border bg-sand transition-colors',
                  index === activeIndex ? 'border-ink' : 'border-transparent hover:border-pebble',
                )}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default ProductImages;
