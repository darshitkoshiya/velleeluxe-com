import type { ReactNode } from 'react';

/** Centred card used by the sign-in and register pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="text-center font-sans text-3xl font-medium text-ink">{title}</h1>
        <p className="mt-3 text-center font-serif text-lg italic text-slateGrey">{subtitle}</p>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-sand" />
      <span className="font-sans text-[11px] uppercase tracking-[0.16em] text-pebble">or</span>
      <span className="h-px flex-1 bg-sand" />
    </div>
  );
}

/** Only allow redirects to paths on this site (prevents open-redirect abuse). */
export function safeRedirect(value: string | null, fallback = '/account/orders'): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return fallback;
}
