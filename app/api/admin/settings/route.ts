/**
 * GET  /api/admin/settings — returns { codEnabled, freeShippingThreshold, returnWindowByCategory }
 * POST /api/admin/settings — body { codEnabled?: boolean, freeShippingThreshold?: number,
 *                                   returnWindowByCategory?: Record<string, number> }
 *                            (at least one field; only the fields sent are changed)
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getStoreSettings,
  isValidFreeShippingThreshold,
  isValidReturnWindowByCategory,
  MAX_FREE_SHIPPING_THRESHOLD,
  MAX_RETURN_WINDOW_DAYS,
  SETTINGS_CACHE_TAG,
  updateStoreSettings,
  type StoreSettings,
} from '@/lib/settings';

export const dynamic = 'force-dynamic';

function toResponse(settings: StoreSettings) {
  return {
    codEnabled: settings.codEnabled,
    freeShippingThreshold: settings.freeShippingThreshold,
    returnWindowByCategory: settings.returnWindowByCategory,
  };
}

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json(toResponse(settings));
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

  const input = (body ?? {}) as {
    codEnabled?: unknown;
    freeShippingThreshold?: unknown;
    returnWindowByCategory?: unknown;
  };
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

  if (input.returnWindowByCategory !== undefined) {
    if (!isValidReturnWindowByCategory(input.returnWindowByCategory)) {
      return NextResponse.json(
        {
          error: `Return windows need a category name and a whole number of days between 1 and ${MAX_RETURN_WINDOW_DAYS}.`,
        },
        { status: 400 },
      );
    }
    if (input.returnWindowByCategory.default === undefined) {
      return NextResponse.json({ error: 'The Default return window is required.' }, { status: 400 });
    }
    // Store trimmed category names.
    const cleaned: Record<string, number> = {};
    for (const [key, days] of Object.entries(input.returnWindowByCategory)) {
      cleaned[key.trim()] = days;
    }
    updates.returnWindowByCategory = cleaned;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  try {
    const settings = await updateStoreSettings(updates);
    // Refresh server-rendered pages that show store settings.
    revalidateTag(SETTINGS_CACHE_TAG);
    return NextResponse.json(toResponse(settings));
  } catch (error) {
    console.error('[api/admin/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
