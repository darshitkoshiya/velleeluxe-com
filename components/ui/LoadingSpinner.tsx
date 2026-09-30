import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  /** Screen-reader text. */
  label?: string;
}

export function LoadingSpinner({ size = 24, className, label = 'Loading' }: LoadingSpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin text-persimmon"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Centred spinner for full-page / section loading states. */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingSpinner size={32} label={label} />
    </div>
  );
}

export default LoadingSpinner;
