import { cn, titleCase } from '@/lib/utils';

/**
 * Maps colour names from the sheet to Tailwind background classes.
 * Brand tokens are used where they fit; Tailwind's palette covers the rest.
 * Unknown colours fall back to a neutral pebble swatch.
 */
const SWATCHES: Record<string, string> = {
  white: 'bg-white',
  'off white': 'bg-linen',
  ivory: 'bg-linen',
  cream: 'bg-linen',
  ecru: 'bg-surface',
  beige: 'bg-sand',
  sand: 'bg-sand',
  stone: 'bg-pebble',
  grey: 'bg-pebble',
  gray: 'bg-pebble',
  charcoal: 'bg-ink-muted',
  black: 'bg-ink',
  navy: 'bg-ink',
  blue: 'bg-oxford',
  'light blue': 'bg-sky-200',
  'sky blue': 'bg-sky-200',
  sky: 'bg-sky-200',
  lavender: 'bg-violet-200',
  lilac: 'bg-violet-200',
  pink: 'bg-rose-200',
  rust: 'bg-persimmon',
  terracotta: 'bg-persimmon',
  olive: 'bg-lime-800',
  green: 'bg-emerald-800',
  sage: 'bg-emerald-200',
  teal: 'bg-teal-700',
  brown: 'bg-amber-900',
  khaki: 'bg-amber-200',
  yellow: 'bg-amber-200',
  maroon: 'bg-rose-900',
  burgundy: 'bg-rose-900',
};

export function swatchClass(colour: string): string {
  const key = colour.trim().toLowerCase().replace(/[-_]+/g, ' ');
  return SWATCHES[key] ?? 'bg-pebble';
}

interface ColourSwatchProps {
  colour: string;
  size?: 'sm' | 'md';
  /** Show the colour name next to the dot. */
  showLabel?: boolean;
  className?: string;
}

export function ColourSwatch({ colour, size = 'sm', showLabel = false, className }: ColourSwatchProps) {
  if (!colour) return null;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block shrink-0 rounded-full border border-pebble/60',
          size === 'sm' ? 'h-3 w-3' : 'h-5 w-5',
          swatchClass(colour),
        )}
      />
      {showLabel ? (
        <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-slateGrey">{titleCase(colour)}</span>
      ) : (
        <span className="sr-only">{titleCase(colour)}</span>
      )}
    </span>
  );
}

export default ColourSwatch;
