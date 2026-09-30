'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/lib/types';
import { SizeSelector } from './SizeSelector';
import { WishlistButton } from './WishlistButton';

/** Size selection + Add to Cart + wishlist, for the product page. */
export function AddToCart({ product }: { product: Product }) {
  const { addItem, openDrawer } = useCart();
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [error, setError] = useState<string | undefined>();
  const soldOut = product.stock === 0;

  const handleAdd = () => {
    if (!size) {
      setError('Please select a size.');
      return;
    }
    addItem(product, size, 1);
    openDrawer();
  };

  return (
    <div className="space-y-6">
      {product.sizes.length > 0 ? (
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
      ) : null}

      <div className="flex items-stretch gap-3">
        <Button variant="primary" size="lg" width="full" onClick={handleAdd} disabled={soldOut}>
          {soldOut ? 'Sold Out' : 'Add to Cart'}
        </Button>
        <WishlistButton
          productId={product.id}
          productName={product.name}
          className="h-14 w-14 shrink-0 rounded-sm border border-sand hover:border-ink"
        />
      </div>
    </div>
  );
}

export default AddToCart;
