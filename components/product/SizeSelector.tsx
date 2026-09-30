'use client';

import { cn } from '@/lib/utils';

interface SizeSelectorProps {
  sizes: string[];
  selected: string | null;
  onSelect: (size: string) => void;
  /** Sizes that cannot be selected (out of stock). */
  disabledSizes?: string[];
  error?: string;
}

export function SizeSelector({ sizes, selected, onSelect, disabledSizes = [], error }: SizeSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Select a size</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size" aria-describedby={error ? 'size-error' : undefined}>
        {sizes.map((size) => {
          const disabled = disabledSizes.includes(size);
          const isSelected = selected === size;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={disabled ? `${size} — out of stock` : size}
              disabled={disabled}
              onClick={() => onSelect(size)}
              className={cn(
                'h-11 min-w-[52px] rounded-sm border px-3 font-sans text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                isSelected && 'border-persimmon bg-persimmon text-white',
                !isSelected && !disabled && 'border-sand bg-sand text-ink hover:border-ink',
                disabled && 'cursor-not-allowed border-sand bg-transparent text-pebble line-through',
              )}
            >
              {size}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id="size-error" role="alert" className="mt-2 font-sans text-xs text-persimmon">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default SizeSelector;
