'use client';

import { useEffect, useState } from 'react';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/lib/utils';

/**
 * Shipping settings set by the admin at /admin/settings (free-shipping threshold and
 * flat shipping fee), read from the public /api/settings endpoint. Shows the defaults
 * from lib/utils until they load.
 *
 * The request is shared by every component on the page and repeated at most once a minute.
 */
const REFRESH_AFTER_MS = 60_000;

interface ShippingSettings {
  freeShippingThreshold: number;
  shippingFee: number;
}

const DEFAULTS: ShippingSettings = {
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  shippingFee: SHIPPING_FEE,
};

let cachedValue: ShippingSettings | null = null;
let cachedAt = 0;
let inFlight: Promise<ShippingSettings> | null = null;

function readAmount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function loadShippingSettings(): Promise<ShippingSettings> {
  if (cachedValue !== null && Date.now() - cachedAt < REFRESH_AFTER_MS) {
    return Promise.resolve(cachedValue);
  }
  if (!inFlight) {
    inFlight = fetch('/api/settings', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { freeShippingThreshold?: unknown; shippingFee?: unknown } | null) => {
        const settings: ShippingSettings = {
          freeShippingThreshold: readAmount(data?.freeShippingThreshold, DEFAULTS.freeShippingThreshold),
          shippingFee: readAmount(data?.shippingFee, DEFAULTS.shippingFee),
        };
        cachedValue = settings;
        cachedAt = Date.now();
        return settings;
      })
      .catch(() => cachedValue ?? DEFAULTS)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

function useShippingSettings(): ShippingSettings {
  const [settings, setSettings] = useState<ShippingSettings>(cachedValue ?? DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    void loadShippingSettings().then((value) => {
      if (!cancelled) setSettings(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

export function useFreeShippingThreshold(): number {
  return useShippingSettings().freeShippingThreshold;
}

/** Flat shipping fee (INR) charged on orders below the free-shipping threshold. */
export function useShippingFee(): number {
  return useShippingSettings().shippingFee;
}
