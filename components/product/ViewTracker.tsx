'use client';

import { useEffect } from 'react';

/** Logs one product view on mount. Completely silent — renders nothing, ignores errors. */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch('/api/products/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    }).catch(() => {}); // silent
  }, [slug]);
  return null;
}
