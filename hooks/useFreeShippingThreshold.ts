'use client';

import { useEffect, useState } from 'react';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/utils';

/**
 * Free-shipping threshold (INR) set by the admin at /admin/settings, read from the
 * public /api/settings endpoint. Shows the default from lib/utils until it loads.
 *
 * The request is shared by every component on the page and repeated at most once a minute.
 */
const REFRESH_AFTER_MS = 60_000;

let cachedValue: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number> | null = null;

function loadThreshold(): Promise<number> {
  if (cachedValue !== null && Date.now() - cachedAt < REFRESH_AFTER_MS) {
    return Promise.resolve(cachedValue);
  }
  if (!inFlight) {
    inFlight = fetch('/api/settings', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { freeShippingThreshold?: unknown } | null) => {
        const value = data?.freeShippingThreshold;
        const threshold = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : FREE_SHIPPING_THRESHOLD;
        cachedValue = threshold;
        cachedAt = Date.now();
        return threshold;
      })
      .catch(() => cachedValue ?? FREE_SHIPPING_THRESHOLD)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useFreeShippingThreshold(): number {
  const [threshold, setThreshold] = useState<number>(cachedValue ?? FREE_SHIPPING_THRESHOLD);

  useEffect(() => {
    let cancelled = false;
    void loadThreshold().then((value) => {
      if (!cancelled) setThreshold(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return threshold;
}
