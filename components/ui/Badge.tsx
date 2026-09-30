import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'sand' | 'oxford' | 'ink' | 'persimmon' | 'outline' | 'muted';

const variants: Record<BadgeVariant, string> = {
  sand: 'bg-sand text-ink border-sand',
  oxford: 'bg-oxford text-white border-oxford',
  ink: 'bg-ink text-linen border-ink',
  persimmon: 'bg-persimmon text-white border-persimmon',
  outline: 'bg-transparent text-ink border-ink',
  muted: 'bg-transparent text-slateGrey border-pebble',
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'sand', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.14em]',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
