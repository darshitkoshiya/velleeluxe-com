/**
 * GET  /api/admin/settings — returns { codEnabled, freeShippingThreshold, shippingFee, returnWindowByCategory, ... }
 * POST /api/admin/settings — body { codEnabled?: boolean, freeShippingThreshold?: number, shippingFee?: number,
 *                                   returnWindowByCategory?: Record<string, number>,
 *                                   socialLinks?: { instagram, facebook, twitter, youtube, pinterest },
 *                                   stockNotFoundBehaviour?: 'sold_out' | 'unlimited',
 *                                   brandPromise?: { icon, title, description }[],
 *                                   pickupPincode?: string, tpin?: string }
 *                            (at least one field; only the fields sent are changed)
 *                            pickupPincode needs the admin TPIN (wrong -> 401 "Incorrect TPIN").
 *                            Or body { ekartConfig: { clientId?, username?, password?, staticToken?, baseUrl? }, tpin }
 *                            — saved alone to Firestore config/ekart.credentials, returns { success: true }.
 *                   GET also returns ekartStatus { configured, source, hasClientId, hasToken } (no secret values).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getStoreSettings,
  isValidBrandPromise,
  isValidFreeShippingThreshold,
  isValidPickupPincode,
  isValidReturnWindowByCategory,
  isValidShippingFee,
  isValidStockNotFoundBehaviour,
  MAX_BRAND_PROMISE_ITEMS,
  MAX_FREE_SHIPPING_THRESHOLD,
  MAX_RETURN_WINDOW_DAYS,
  MAX_SHIPPING_FEE,
  MIN_BRAND_PROMISE_ITEMS,
  parseSocialLinks,
  SETTINGS_CACHE_TAG,
  updateStoreSettings,
  type BrandPromiseItem,
  type StoreSettings,
} from '@/lib/settings';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getEkartConfigStatus } from '@/lib/pincode';
import { assertAdminTpin, StoreCreditError } from '@/lib/store-credit';

export const dynamic = 'force-dynamic';

const EKART_FIELDS = ['clientId', 'username', 'password', 'staticToken', 'baseUrl'] as const;
const MAX_EKART_FIELD_LENGTH = 4096;

/**
 * Saves Ekart API credentials to Firestore `config/ekart.credentials` (merge, so the cached
 * auth token fields and any credential not sent are kept). Blank fields are ignored.
 */
async function saveEkartConfig(rawConfig: unknown, tpin: unknown): Promise<NextResponse> {
  try {
    assertAdminTpin(tpin);
  } catch (error) {
    if (error instanceof StoreCreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not verify TPIN.' }, { status: 500 });
  }

  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return NextResponse.json({ error: 'ekartConfig must be an object.' }, { status: 400 });
  }
  const config = rawConfig as Record<string, unknown>;

  const credentials: Record<string, string> = {};
  for (const field of EKART_FIELDS) {
    const value = config[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      return NextResponse.json({ error: `${field} must be text.` }, { status: 400 });
    }
    const trimmed = value.trim();
    if (field === 'clientId' && trimmed === '') {
      return NextResponse.json({ error: 'Client ID cannot be empty.' }, { status: 400 });
    }
    if (!trimmed) continue;
    if (trimmed.length > MAX_EKART_FIELD_LENGTH) {
      return NextResponse.json({ error: `${field} is too long.` }, { status: 400 });
    }
    if (field === 'baseUrl' && !/^https?:\/\/\S+$/i.test(trimmed)) {
      return NextResponse.json({ error: 'Base URL must start with https://' }, { status: 400 });
    }
    credentials[field] = field === 'baseUrl' ? trimmed.replace(/\/+$/, '') : trimmed;
  }

  if (Object.keys(credentials).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  try {
    const update: Record<string, unknown> = { credentials, credentialsUpdatedAt: Date.now() };
    // New login details or base URL make the cached auth token stale — drop it so the next check logs in again.
    if (credentials.clientId || credentials.username || credentials.password || credentials.baseUrl) {
      update.token = FieldValue.delete();
      update.expiresAt = FieldValue.delete();
    }
    await getAdminDb().collection('config').doc('ekart').set(update, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/admin/settings] Failed to save Ekart config:', error);
    return NextResponse.json({ error: 'Could not save Ekart config.' }, { status: 500 });
  }
}

function toResponse(settings: StoreSettings) {
  return {
    codEnabled: settings.codEnabled,
    freeShippingThreshold: settings.freeShippingThreshold,
    shippingFee: settings.shippingFee,
    returnWindowByCategory: settings.returnWindowByCategory,
    socialLinks: settings.socialLinks,
    stockNotFoundBehaviour: settings.stockNotFoundBehaviour,
    brandPromise: settings.brandPromise,
    pickupPincode: settings.pickupPincode,
  };
}

export async function GET() {
  try {
    const [settings, ekartStatus] = await Promise.all([getStoreSettings(), getEkartConfigStatus()]);
    // ekartStatus only says whether credentials exist — never their values.
    return NextResponse.json({ ...toResponse(settings), ekartStatus });
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
    shippingFee?: unknown;
    returnWindowByCategory?: unknown;
    socialLinks?: unknown;
    stockNotFoundBehaviour?: unknown;
    brandPromise?: unknown;
    pickupPincode?: unknown;
    ekartConfig?: unknown;
    tpin?: unknown;
  };

  // Ekart credentials are saved on their own (separate Firestore doc) and need the admin TPIN.
  if (input.ekartConfig !== undefined) {
    return saveEkartConfig(input.ekartConfig, input.tpin);
  }

  const updates: Partial<StoreSettings> = {};

  if (input.pickupPincode !== undefined) {
    // Changing the warehouse pincode affects every delivery check, so it needs the admin TPIN.
    try {
      assertAdminTpin(input.tpin);
    } catch (error) {
      if (error instanceof StoreCreditError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: 'Could not verify TPIN.' }, { status: 500 });
    }
    const pincode = typeof input.pickupPincode === 'string' ? input.pickupPincode.trim() : input.pickupPincode;
    if (!isValidPickupPincode(pincode)) {
      return NextResponse.json({ error: 'Pickup pincode must be exactly 6 digits.' }, { status: 400 });
    }
    updates.pickupPincode = pincode;
  }

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

  if (input.shippingFee !== undefined) {
    if (!isValidShippingFee(input.shippingFee)) {
      return NextResponse.json(
        {
          error: `Shipping fee must be a whole number of rupees between 0 and ₹${MAX_SHIPPING_FEE.toLocaleString('en-IN')}.`,
        },
        { status: 400 },
      );
    }
    updates.shippingFee = input.shippingFee;
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

  if (input.socialLinks !== undefined) {
    const parsed = parseSocialLinks(input.socialLinks);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    updates.socialLinks = parsed.links;
  }

  if (input.stockNotFoundBehaviour !== undefined) {
    if (!isValidStockNotFoundBehaviour(input.stockNotFoundBehaviour)) {
      return NextResponse.json({ error: "stockNotFoundBehaviour must be 'sold_out' or 'unlimited'." }, { status: 400 });
    }
    updates.stockNotFoundBehaviour = input.stockNotFoundBehaviour;
  }

  if (input.brandPromise !== undefined) {
    if (!isValidBrandPromise(input.brandPromise)) {
      return NextResponse.json(
        {
          error: `Brand promise must be ${MIN_BRAND_PROMISE_ITEMS}–${MAX_BRAND_PROMISE_ITEMS} items, each with a valid icon, title, and description.`,
        },
        { status: 400 },
      );
    }
    // Store only the known fields, with surrounding whitespace removed.
    updates.brandPromise = (input.brandPromise as BrandPromiseItem[]).map((item) => ({
      icon: item.icon,
      title: item.title.trim(),
      description: item.description.trim(),
    }));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  try {
    const settings = await updateStoreSettings(updates);
    // Refresh server-rendered pages that show store settings.
    revalidateTag(SETTINGS_CACHE_TAG);
    // Product stock depends on stockNotFoundBehaviour — reload products so the change shows now.
    if (updates.stockNotFoundBehaviour !== undefined) revalidateTag('products');
    return NextResponse.json(toResponse(settings));
  } catch (error) {
    console.error('[api/admin/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
