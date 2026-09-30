'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { getAuthErrorMessage } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { AuthCard, OrDivider, safeRedirect } from '@/components/account/AuthCard';
import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/Icons';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const { user, loading, signIn, signInWithGoogle, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'email' | 'google' | null>(null);

  // Already signed in (or just signed in) — move on.
  useEffect(() => {
    if (!loading && user) router.replace(redirectTo);
  }, [user, loading, router, redirectTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting('email');
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSubmitting(null);
    }
  };

  const handleGoogle = async () => {
    setSubmitting('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSubmitting(null);
    }
  };

  if (loading || user) return <PageLoader />;

  const registerHref = searchParams.get('redirect')
    ? `/account/register?redirect=${encodeURIComponent(redirectTo)}`
    : '/account/register';

  return (
    <AuthCard title="Sign In" subtitle="Welcome back.">
      {!isConfigured ? (
        <p className="mb-6 border border-sand p-4 font-sans text-sm text-slateGrey">
          Accounts are temporarily unavailable. You can still check out as a guest.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p role="alert" className="font-sans text-sm text-persimmon">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" size="lg" width="full" loading={submitting === 'email'} disabled={!isConfigured || submitting !== null}>
          Sign In
        </Button>
      </form>

      <OrDivider />

      <Button variant="outline" size="lg" width="full" onClick={handleGoogle} loading={submitting === 'google'} disabled={!isConfigured || submitting !== null}>
        <GoogleIcon />
        Sign in with Google
      </Button>

      <p className="mt-8 text-center font-serif text-base text-slateGrey">
        New to Vellee Luxe?{' '}
        <Link href={registerHref} className="text-persimmon underline underline-offset-4 hover:text-ink">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
