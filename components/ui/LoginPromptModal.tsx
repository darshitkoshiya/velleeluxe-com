'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useLoginPrompt } from '@/lib/login-prompt-store';
import { CloseIcon } from '@/components/ui/Icons';
import { buttonClasses } from '@/components/ui/Button';

export function LoginPromptModal() {
  const { isOpen, close } = useLoginPrompt();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm border border-sand bg-linen p-8 shadow-xl">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 text-ink-muted hover:text-ink"
        >
          <CloseIcon width={18} height={18} />
        </button>

        <div className="text-center">
          <p className="font-serif text-2xl italic text-ink" id="login-prompt-title">
            Sign in to save items
          </p>
          <p className="mt-2 font-sans text-sm text-ink-muted">
            Create an account or sign in to add items to your wishlist and access them from any device.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/account/login?redirect=/account/wishlist"
            onClick={close}
            className={buttonClasses({ variant: 'primary', size: 'lg' })}
          >
            Sign In
          </Link>
          <Link
            href="/account/register"
            onClick={close}
            className={buttonClasses({ variant: 'outline', size: 'lg' })}
          >
            Create Account
          </Link>
          <button
            type="button"
            onClick={close}
            className="font-sans text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}
