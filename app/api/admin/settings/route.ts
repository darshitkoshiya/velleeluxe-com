/**
 * GET  /api/admin/settings — returns { codEnabled, freeShippingThreshold }
 * POST /api/admin/settings — body { codEnabled?: boolean, freeShippingThreshold?: number }
 *                            (at least one field; only the fields sent are changed)
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getStoreSettings,
  isValidFreeShippingThreshold,
  MAX_FREE_SHIPPING_THRESHOLD,
  SETTINGS_CACHE_TAG,
  updateStoreSettings,
  type StoreSettings,
} from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json({
      codEnabled: settings.codEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
    });
  } catch (error) {
    console.error('[api/admin/settings] Failed to read settings:', error);
    return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const input = (body ?? {}) as { codEnabled?: unknown; freeShippingThreshold?: unknown };
  const updates: Partial<StoreSettings> = {};

  if (input.codEnabled !== undefined) {
    if (typeof input.codEnabled !== 'boolean') {
      return NextResponse.json({ error: 'codEnabled must be true or false.' }, { status: 400 });
    }
    updates.codEnabled = input.codEnabled;
  }

  if (input.freeShippingThreshold !== undefined) {
    if (!isValidFreeShippingThreshold(input.freeShippingThreshold)) {
      return NextResponse.json(
        {
          error: `Free shipping threshold must be a whole number of rupees between 0 and ${MAX_FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')}.`,
        },
        { status: 400 },
      );
    }
    updates.freeShippingThreshold = input.freeShippingThreshold;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  try {
    const settings = await updateStoreSettings(updates);
    // Refresh server-rendered pages that show the free-shipping threshold.
    revalidateTag(SETTINGS_CACHE_TAG);
    return NextResponse.json({
      codEnabled: settings.codEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
    });
  } catch (error) {
    console.error('[api/admin/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
