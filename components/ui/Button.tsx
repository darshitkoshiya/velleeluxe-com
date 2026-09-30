import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
/**
 * - "mobile" (default): full width on phones, natural width from the `sm` breakpoint up
 * - "full": always full width
 * - "auto": always natural width
 */
export type ButtonWidth = 'mobile' | 'full' | 'auto';

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm border font-sans font-medium uppercase tracking-[0.14em] ' +
  'transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-persimmon border-persimmon text-white hover:bg-ink hover:border-ink',
  secondary: 'bg-ink border-ink text-white hover:bg-persimmon hover:border-persimmon',
  outline: 'bg-transparent border-ink text-ink hover:bg-ink hover:text-linen',
  ghost: 'bg-transparent border-transparent text-ink hover:text-persimmon',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[11px]',
  md: 'h-11 px-6 text-xs',
  lg: 'h-14 px-8 text-[13px]',
};

const widths: Record<ButtonWidth, string> = {
  mobile: 'w-full sm:w-auto',
  full: 'w-full',
  auto: '',
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: ButtonWidth;
  className?: string;
}

/** Button classes — use on <Link> elements so links look identical to buttons. */
export function buttonClasses({ variant = 'primary', size = 'md', width = 'mobile', className }: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], widths[width], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, width, loading = false, className, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, width, className })}
      {...props}
    >
      {loading ? <LoadingSpinner size={16} className="[&_svg]:text-current" label="Please wait" /> : null}
      {children}
    </button>
  );
});

export default Button;
