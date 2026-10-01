'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { getClientDb } from '@/lib/firebase';
import { STORE_CREDIT_COLLECTION, STORE_CREDIT_DOC } from '@/lib/returns-shared';
import type { StoreCredit } from '@/lib/types';

export interface UseStoreCreditResult {
  /** Available balance in INR (0 when the customer has none or is signed out). */
  balance: number;
  /** Newest first. */
  transactions: StoreCredit['transactions'];
  loading: boolean;
  error: string | null;
  /**
   * How much credit can be used against an order total (never more than the total).
   * Checkout integration: show this as a discount, then have the server write a 'debit'
   * ledger entry ("Applied to Order VL-...") via lib/store-credit.ts when the order is placed.
   */
  applicableAmount: (orderTotal: number) => number;
}

/**
 * Live store credit for the signed-in customer, read from users/{uid}/storeCredit/summary.
 * Credit is only ever written by the server (admin resolving a return).
 */
export function useStoreCredit(): UseStoreCreditResult {
  const { user } = useAuth();
  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCredit(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(getClientDb(), 'users', user.uid, STORE_CREDIT_COLLECTION, STORE_CREDIT_DOC);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Partial<StoreCredit>) : undefined;
        setCredit({
          balance: typeof data?.balance === 'number' ? data.balance : 0,
          transactions: Array.isArray(data?.transactions) ? data.transactions : [],
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[store-credit] Could not load store credit:', err);
        setError('We could not load your store credit.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const balance = credit?.balance ?? 0;
  const applicableAmount = useCallback(
    (orderTotal: number) => Math.max(0, Math.min(balance, Number.isFinite(orderTotal) ? orderTotal : 0)),
    [balance],
  );

  const transactions = [...(credit?.transactions ?? [])].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );

  return { balance, transactions, loading, error, applicableAmount };
}
