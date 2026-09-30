'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuthErrorMessage } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { getClientAuth, getClientDb } from '@/lib/firebase';
import { cn, isValidEmail, normaliseIndianPhone } from '@/lib/utils';

type Tab = 'login' | 'signup';

export default function AccountPage() {
  const { user, loading } = useAuth();

  return (
    <div className="bg-linen">
      {loading ? <PageLoader /> : user ? <ProfileView user={user} /> : <AuthTabs />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signed out: Sign In / Create Account tabs                           */
/* ------------------------------------------------------------------ */

function AuthTabs() {
  const [tab, setTab] = useState<Tab>('login');
  const { isConfigured } = useAuth();

  return (
    <div className="container-page flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="text-center font-sans text-3xl font-medium text-ink">Your Account</h1>
        <p className="mt-3 text-center font-serif text-lg italic text-ink-muted">Track orders and keep a wishlist.</p>

        <div role="tablist" aria-label="Account" className="mt-10 grid grid-cols-2 border-b border-sand">
          {(['login', 'signup'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`tab-${value}`}
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              onClick={() => setTab(value)}
              className={cn(
                '-mb-px border-b-2 pb-3 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors',
                tab === value ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {value === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {!isConfigured ? (
          <p className="mt-8 border border-sand p-4 font-sans text-sm text-ink-muted">
            Accounts are temporarily unavailable. You can still check out as a guest.
          </p>
        ) : null}

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-8">
          {tab === 'login' ? <LoginForm /> : <SignupForm />}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      // AuthProvider picks up the new user and the page switches to the profile view.
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setNotice(null);
    if (!isValidEmail(email)) {
      setError('Enter your email above, then tap "Forgot password?" again.');
      return;
    }
    setResetting(true);
    setError(null);
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
      setNotice(`If an account exists for ${email.trim()}, a reset link is on its way. Check your inbox.`);
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      // Don't reveal whether an account exists.
      if (code === 'auth/user-not-found') {
        setNotice(`If an account exists for ${email.trim()}, a reset link is on its way. Check your inbox.`);
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div>
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={!isConfigured || resetting}
          className="mt-2 font-sans text-xs text-ink-muted underline underline-offset-4 hover:text-accent disabled:opacity-50"
        >
          {resetting ? 'Sending reset link...' : 'Forgot password?'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="font-sans text-sm text-accent">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="border border-sand bg-surface p-3 font-sans text-sm text-ink">
          {notice}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" size="lg" width="full" loading={submitting} disabled={!isConfigured || submitting}>
        Sign In
      </Button>
    </form>
  );
}

type SignupField = 'name' | 'email' | 'password' | 'confirmPassword';

function SignupForm() {
  const { register, isConfigured } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<SignupField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: Partial<Record<SignupField, string>> = {};
    if (name.trim().length < 2) next.name = 'Please enter your name.';
    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      // Creates the user, sets displayName and signs them in automatically.
      await register(name, email, password);
    } catch (err) {
      setFormError(getAuthErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
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

      {formError ? (
        <p role="alert" className="font-sans text-sm text-accent">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" size="lg" width="full" loading={submitting} disabled={!isConfigured || submitting}>
        Create Account
      </Button>

      <p className="text-center font-sans text-xs text-ink-muted">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-4 hover:text-accent">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy-policy" className="underline underline-offset-4 hover:text-accent">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Signed in: profile                                                  */
/* ------------------------------------------------------------------ */

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || '';
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase() || 'VL';
}

function profileDoc(uid: string) {
  return doc(getClientDb(), 'users', uid, 'profile', 'details');
}

function ProfileView({ user }: { user: User }) {
  const { signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Phone number is stored on the customer's profile document.
  useEffect(() => {
    let cancelled = false;
    getDoc(profileDoc(user.uid))
      .then((snapshot) => {
        const saved = snapshot.data() as { phone?: string; name?: string } | undefined;
        if (cancelled || !saved) return;
        if (saved.phone) setPhone(saved.phone);
        if (!user.displayName && saved.name) setDisplayName(saved.name);
      })
      .catch((error) => console.error('[account] Could not load profile:', error));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const email = user.email ?? '';

  return (
    <div className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="label-caps text-oxford">Your Account</p>

        <section className="mt-6 flex items-center gap-5 border-b border-sand pb-8">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-lg font-medium tracking-[0.08em] text-linen"
          >
            {initialsFor(displayName, email)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-sans text-2xl font-medium text-ink">{displayName || 'Welcome'}</h1>
            <p className="truncate font-sans text-sm text-ink-muted">{email}</p>
            {phone ? <p className="font-sans text-sm text-ink-muted">{phone}</p> : null}
          </div>
        </section>

        <nav aria-label="Account" className="mt-2 divide-y divide-sand border-b border-sand">
          <AccountLink href="/account/orders" title="My Orders" description="Track and review your orders" />
          <AccountLink href="/wishlist" title="My Wishlist" description="Shirts you have saved for later" />
        </nav>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="label-caps text-ink">Profile Details</h2>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-sans text-xs uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-accent"
              >
                Edit Profile
              </button>
            ) : null}
          </div>

          {editing ? (
            <EditProfileForm
              user={user}
              initialName={displayName}
              initialPhone={phone}
              onCancel={() => setEditing(false)}
              onSaved={(name, nextPhone) => {
                setDisplayName(name);
                setPhone(nextPhone);
                setEditing(false);
              }}
            />
          ) : (
            <dl className="mt-5 grid gap-4 border border-sand bg-surface p-5 font-sans text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-muted">Name</dt>
                <dd className="mt-1 break-words text-ink">{displayName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-muted">Email</dt>
                <dd className="mt-1 break-words text-ink">{email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-ink-muted">Phone</dt>
                <dd className="mt-1 text-ink">{phone || '—'}</dd>
              </div>
            </dl>
          )}
        </section>

        <div className="mt-12">
          <Button
            variant="outline"
            size="md"
            loading={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

function AccountLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 py-5">
      <span>
        <span className="block font-sans text-base font-medium text-ink group-hover:text-accent">{title}</span>
        <span className="mt-0.5 block font-serif text-sm italic text-ink-muted">{description}</span>
      </span>
      <ArrowRightIcon className="shrink-0 text-ink transition-transform group-hover:translate-x-1 group-hover:text-accent" />
    </Link>
  );
}

function EditProfileForm({
  user,
  initialName,
  initialPhone,
  onCancel,
  onSaved,
}: {
  user: User;
  initialName: string;
  initialPhone: string;
  onCancel: () => void;
  onSaved: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: { name?: string; phone?: string } = {};
    const trimmedName = name.trim();
    const cleanPhone = phone.trim() ? normaliseIndianPhone(phone) : '';
    if (trimmedName.length < 2) next.name = 'Please enter your name.';
    if (cleanPhone === null) next.phone = 'Please enter a valid 10-digit mobile number.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      if (trimmedName !== (user.displayName ?? '')) await updateProfile(user, { displayName: trimmedName });
      await setDoc(
        profileDoc(user.uid),
        { name: trimmedName, phone: cleanPhone ?? '', email: user.email ?? '', updatedAt: serverTimestamp() },
        { merge: true },
      );
      onSaved(trimmedName, cleanPhone ?? '');
    } catch (err) {
      console.error('[account] Could not update profile:', err);
      setFormError('We could not save your changes. Please try again.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5 border border-sand p-5">
      <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <Input label="Email" type="email" value={user.email ?? ''} disabled hint="Email cannot be changed here." />
      <Input
        label="Phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
        optional
      />
      {formError ? (
        <p role="alert" className="font-sans text-sm text-accent">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" variant="secondary" size="md" loading={saving}>
          Save Changes
        </Button>
        <Button variant="ghost" size="md" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
