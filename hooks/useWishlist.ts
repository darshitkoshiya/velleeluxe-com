'use client';

/**
 * Wishlist shared across the whole page.
 *
 * - Signed in: stored in Firestore at users/{userId}/wishlist/{productId}
 * - Guest: stored in localStorage
 * - When a guest signs in, their saved items are moved into their account.
 *
 * A single module-level store means every product card shares ONE Firestore
 * listener instead of each card opening its own.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'vl-wishlist-v1';
const EMPTY: string[] = [];

let ids: string[] = EMPTY;
let currentUid: string | null | undefined; // undefined = not initialised yet
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(next: string[]) {
  ids = next;
  listeners.forEach((listener) => listener());
}

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(next: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors (private mode etc.).
  }
}

function wishlistDoc(uid: string, productId: string) {
  return doc(getClientDb(), 'users', uid, 'wishlist', productId);
}

/** Switches the store between guest (localStorage) and a signed-in user (Firestore). */
function setActiveUser(uid: string | null) {
  if (uid === currentUid) return;
  currentUid = uid;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!uid) {
    emit(readLocal());
    return;
  }

  // Move any guest items into the account.
  const guestItems = readLocal();
  if (guestItems.length > 0) {
    writeLocal([]);
    guestItems.forEach((productId) => {
      setDoc(wishlistDoc(uid, productId), { productId, addedAt: serverTimestamp() }).catch((error) =>
        console.error('[wishlist] Could not merge guest item:', error),
      );
    });
  }

  unsubscribeFirestore = onSnapshot(
    collection(getClientDb(), 'users', uid, 'wishlist'),
    (snapshot) => emit(snapshot.docs.map((d) => d.id)),
    (error) => console.error('[wishlist] Could not load wishlist:', error),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => ids;
const getServerSnapshot = () => EMPTY;

export interface UseWishlistResult {
  wishlist: string[];
  toggle: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  /** True until we know whether to read from Firestore or localStorage. */
  loading: boolean;
}

export function useWishlist(): UseWishlistResult {
  const { user, loading: authLoading, isConfigured } = useAuth();
  const wishlist = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (authLoading) return;
    setActiveUser(isConfigured && user ? user.uid : null);
  }, [user, authLoading, isConfigured]);

  const isWishlisted = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

  const toggle = useCallback(async (productId: string) => {
    const has = ids.includes(productId);
    const next = has ? ids.filter((id) => id !== productId) : [...ids, productId];
    const uid = currentUid;

    emit(next); // Optimistic update — feels instant.

    if (!uid) {
      writeLocal(next);
      return;
    }
    try {
      if (has) {
        await deleteDoc(wishlistDoc(uid, productId));
      } else {
        await setDoc(wishlistDoc(uid, productId), { productId, addedAt: serverTimestamp() });
      }
    } catch (error) {
      console.error('[wishlist] Could not update wishlist:', error);
      emit(has ? [...ids, productId] : ids.filter((id) => id !== productId)); // Roll back.
    }
  }, []);

  return { wishlist, toggle, isWishlisted, loading: authLoading };
}
