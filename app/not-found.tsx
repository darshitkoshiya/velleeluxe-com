import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100svh-64px)] flex-col items-center justify-center bg-linen px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="font-serif text-[clamp(6rem,22vw,11rem)] italic leading-none text-ink">404</p>
      <div className="my-8 h-px w-16 bg-sand" />
      <h1 className="label-caps text-oxford">Page not found</h1>
      <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-ink-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
      <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link href="/" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
          Go Home
        </Link>
        <Link href="/shop" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          Shop Now
        </Link>
      </div>
    </div>
  );
}
