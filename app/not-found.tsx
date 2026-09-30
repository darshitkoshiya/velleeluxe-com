import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100svh-64px)] flex-col items-center justify-center bg-linen px-4 text-center">
      <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.25em] text-oxford">404</p>
      <h1 className="mb-6 font-serif text-3xl italic text-ink">Page not found.</h1>
      <Link
        href="/"
        className="border-b border-ink-muted pb-0.5 font-sans text-[13px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:border-ink hover:text-ink"
      >
        Back to home
      </Link>
    </div>
  );
}
