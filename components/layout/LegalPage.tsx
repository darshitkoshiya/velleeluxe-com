import type { ReactNode } from 'react';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
}

/** Shared layout for policy pages (privacy, terms, shipping, returns). */
export function LegalPage({ title, lastUpdated, intro, children }: LegalPageProps) {
  return (
    <div className="container-page py-16 md:py-24">
      <header className="mx-auto max-w-2xl border-b border-sand pb-10">
        <p className="label-caps text-oxford">Policies</p>
        <h1 className="mt-4 font-sans text-3xl font-medium text-ink md:text-4xl">{title}</h1>
        <p className="mt-3 font-sans text-xs text-slateGrey">Last updated: {lastUpdated}</p>
        {intro ? <div className="mt-6 font-serif text-lg leading-relaxed text-slateGrey">{intro}</div> : null}
      </header>
      <div className="prose-editorial mx-auto mt-10 max-w-2xl">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default LegalPage;
