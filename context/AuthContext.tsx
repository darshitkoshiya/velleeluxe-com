'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getClientAuth, getClientDb, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthContextValue {
  user: User | null;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  /** False when Firebase keys are missing — account features are hidden/disabled. */
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Saves basic profile info at users/{uid}/profile/details. Never blocks sign-in. */
async function saveProfile(user: User, name?: string): Promise<void> {
  try {
    await setDoc(
      doc(getClientDb(), 'users', user.uid, 'profile', 'details'),
      {
        name: name ?? user.displayName ?? '',
        email: user.email ?? '',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('[auth] Could not save profile:', error);
  }
}

function notConfiguredError(): Error {
  return new Error('Accounts are not available right now. Please try again later.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      console.warn('[auth] Firebase is not configured — accounts are disabled.');
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(getClientAuth(), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, [configured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!configured) throw notConfiguredError();
      await signInWithEmailAndPassword(getClientAuth(), email.trim(), password);
    },
    [configured],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!configured) throw notConfiguredError();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(getClientAuth(), provider);
    await saveProfile(credential.user);
  }, [configured]);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!configured) throw notConfiguredError();
      const credential = await createUserWithEmailAndPassword(getClientAuth(), email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      await saveProfile(credential.user, name.trim());
      // Refresh local state so the new display name shows immediately.
      setUser(getClientAuth().currentUser);
    },
    [configured],
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    await firebaseSignOut(getClientAuth());
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isConfigured: configured, signIn, signInWithGoogle, signOut, register }),
    [user, loading, configured, signIn, signInWithGoogle, signOut, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Turns Firebase error codes into friendly messages. */
export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password combination is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Please allow pop-ups and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return error instanceof Error && !code ? error.message : 'Something went wrong. Please try again.';
  }
}
