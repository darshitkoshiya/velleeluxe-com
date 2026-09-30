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
import { isValidEmail } from '@/lib/utils';

type Field = 'name' | 'email' | 'password' | 'confirmPassword' | 'terms';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const { user, loading, register, signInWithGoogle, isConfigured } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'email' | 'google' | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace(redirectTo);
  }, [user, loading, router, redirectTo]);

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) next.name = 'Please enter your name.';
    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    if (!agreed) next.terms = 'Please accept the Terms and Privacy Policy to continue.';
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting('email');
    setFormError(null);
    try {
      await register(name, email, password);
    } catch (err) {
      setFormError(getAuthErrorMessage(err));
      setSubmitting(null);
    }
  };

  const handleGoogle = async () => {
    if (!agreed) {
      setErrors((current) => ({ ...current, terms: 'Please accept the Terms and Privacy Policy to continue.' }));
      return;
    }
    setSubmitting('google');
    setFormError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(getAuthErrorMessage(err));
      setSubmitting(null);
    }
  };

  if (loading || user) return <PageLoader />;

  const loginHref = searchParams.get('redirect') ? `/account/login?redirect=${encodeURIComponent(redirectTo)}` : '/account/login';

  return (
    <AuthCard title="Create Account" subtitle="Track orders and keep a wishlist.">
      {!isConfigured ? (
        <p className="mb-6 border border-sand p-4 font-sans text-sm text-slateGrey">
          Accounts are temporarily unavailable. You can still check out as a guest.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />

        <div>
          <label className="flex cursor-pointer items-start gap-3 font-serif text-base text-slateGrey">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setErrors((current) => ({ ...current, terms: undefined }));
              }}
              className="mt-1.5 h-4 w-4 accent-persimmon"
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? 'terms-error' : undefined}
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-persimmon underline underline-offset-4">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-persimmon underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p id="terms-error" role="alert" className="mt-1.5 font-sans text-xs text-persimmon">
              {errors.terms}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="font-sans text-sm text-persimmon">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="secondary" size="lg" width="full" loading={submitting === 'email'} disabled={!isConfigured || submitting !== null}>
          Create Account
        </Button>
      </form>

      <OrDivider />

      <Button variant="outline" size="lg" width="full" onClick={handleGoogle} loading={submitting === 'google'} disabled={!isConfigured || submitting !== null}>
        <GoogleIcon />
        Sign up with Google
      </Button>

      <p className="mt-8 text-center font-serif text-base text-slateGrey">
        Already have an account?{' '}
        <Link href={loginHref} className="text-persimmon underline underline-offset-4 hover:text-ink">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RegisterForm />
    </Suspense>
  );
}
