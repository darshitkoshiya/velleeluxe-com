/**
 * Pincode delivery check (server-only — uses the Firebase Admin SDK and courier secrets).
 *
 * Order of attempts:
 *   1. Firestore cache `pincodeCache/{pincode}` (7-day TTL)
 *   2. Shiprocket (needs SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD)
 *   3. Ekart (needs EKART_API_KEY)
 *   4. Nothing configured / every courier failed → { serviceable: true } so checkout is never blocked
 *      by a courier outage or missing credentials.
 */
import { getAdminDb } from './firebase-admin';
import { getPickupPincode } from './settings';

export interface ServiceabilityResult {
  serviceable: boolean;
  courier?: string; // which courier can deliver
  estimatedDays?: string; // e.g. "3-5 days"
  cod?: boolean; // COD available at this pincode
  error?: string; // human-readable if not serviceable
}

const CACHE_COLLECTION = 'pincodeCache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
/** Shiprocket tokens last 10 days; refresh a day early to be safe. */
const SHIPROCKET_TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
const EKART_URL = 'https://ekartlogistics.com/ws/getservicedetail';
const REQUEST_TIMEOUT_MS = 8000;

const NOT_SERVICEABLE_MESSAGE = 'Delivery not available to this pincode. Please try a different address.';
const PASSTHROUGH: ServiceabilityResult = { serviceable: true };

export function isValidPincodeFormat(pincode: unknown): pincode is string {
  return typeof pincode === 'string' && /^[1-9]\d{5}$/.test(pincode);
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

async function readCache(pincode: string): Promise<ServiceabilityResult | null> {
  try {
    const snap = await getAdminDb().collection(CACHE_COLLECTION).doc(pincode).get();
    if (!snap.exists) return null;
    const data = snap.data() as
      | { result?: ServiceabilityResult; expiresAt?: number; pickupPincode?: string }
      | undefined;
    if (!data?.result || typeof data.expiresAt !== 'number' || data.expiresAt < Date.now()) return null;
    // Ignore results computed for a different warehouse pickup pincode (older entries have none).
    if (data.pickupPincode !== (await getPickupPincode())) return null;
    return data.result;
  } catch (error) {
    console.warn('[pincode] Cache read failed:', error);
    return null;
  }
}

async function writeCache(pincode: string, result: ServiceabilityResult, source: string): Promise<void> {
  try {
    const pickupPincode = await getPickupPincode();
    await getAdminDb()
      .collection(CACHE_COLLECTION)
      .doc(pincode)
      .set({ result, source, pickupPincode, checkedAt: Date.now(), expiresAt: Date.now() + CACHE_TTL_MS });
  } catch (error) {
    console.warn('[pincode] Cache write failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const json = (await response.json().catch(() => null)) as unknown;
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
  return false;
}

function formatDays(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (/^\d+$/.test(text)) return `${text} ${text === '1' ? 'day' : 'days'}`;
  if (/^\d+\s*-\s*\d+$/.test(text)) return `${text.replace(/\s+/g, '')} days`;
  return text;
}

// ---------------------------------------------------------------------------
// Shiprocket
// ---------------------------------------------------------------------------

/** Error that means "credentials rejected" — the cached token should be dropped. */
class ShiprocketAuthError extends Error {}

async function getShiprocketToken(forceRefresh = false): Promise<string> {
  const ref = getAdminDb().collection('config').doc('shiprocket');

  if (!forceRefresh) {
    try {
      const snap = await ref.get();
      const data = snap.data() as { token?: unknown; expiresAt?: unknown } | undefined;
      if (typeof data?.token === 'string' && typeof data.expiresAt === 'number' && data.expiresAt > Date.now()) {
        return data.token;
      }
    } catch (error) {
      console.warn('[pincode] Could not read cached Shiprocket token:', error);
    }
  }

  const { ok, status, json } = await fetchJson(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
  });
  const token = asRecord(json)?.token;
  if (!ok || typeof token !== 'string' || !token) {
    throw new ShiprocketAuthError(`Shiprocket login failed (HTTP ${status})`);
  }

  try {
    await ref.set({ token, expiresAt: Date.now() + SHIPROCKET_TOKEN_TTL_MS, updatedAt: Date.now() });
  } catch (error) {
    console.warn('[pincode] Could not store Shiprocket token:', error);
  }
  return token;
}

async function shiprocketServiceability(pincode: string, token: string) {
  // Warehouse pincode used as the pickup point for Shiprocket quotes (admin-editable in settings).
  const pickupPincode = await getPickupPincode();
  const url =
    `${SHIPROCKET_BASE}/courier/serviceability/?pickup_postcode=${pickupPincode}` +
    `&delivery_postcode=${pincode}&cod=1&weight=0.5`;
  return fetchJson(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

async function checkShiprocket(pincode: string): Promise<ServiceabilityResult> {
  let token = await getShiprocketToken();
  let response = await shiprocketServiceability(pincode, token);
  if (response.status === 401 || response.status === 403) {
    token = await getShiprocketToken(true);
    response = await shiprocketServiceability(pincode, token);
  }

  const body = asRecord(response.json);
  // Shiprocket answers 404 / status 404 with "no courier" when the pincode can't be served.
  const notServiceable = response.status === 404 || body?.status === 404;
  if (!response.ok && !notServiceable) {
    throw new Error(`Shiprocket serviceability failed (HTTP ${response.status})`);
  }

  const data = asRecord(body?.data);
  const couriers = Array.isArray(data?.available_courier_companies)
    ? (data!.available_courier_companies as unknown[]).map(asRecord).filter((c): c is Record<string, unknown> => !!c)
    : [];

  if (couriers.length === 0) {
    if (!notServiceable && !data) throw new Error('Shiprocket returned an unexpected response');
    return { serviceable: false, error: NOT_SERVICEABLE_MESSAGE };
  }

  const recommendedId = data?.recommended_courier_company_id;
  const best = couriers.find((c) => c.courier_company_id === recommendedId) ?? couriers[0];

  return {
    serviceable: true,
    courier: typeof best.courier_name === 'string' ? best.courier_name : undefined,
    estimatedDays: formatDays(best.estimated_delivery_days),
    cod: couriers.some((c) => truthy(c.cod)),
  };
}

// ---------------------------------------------------------------------------
// Ekart (fallback)
// ---------------------------------------------------------------------------

async function checkEkart(pincode: string): Promise<ServiceabilityResult> {
  const { ok, status, json } = await fetchJson(EKART_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': process.env.EKART_API_KEY ?? '' },
    body: JSON.stringify({ pincode }),
  });
  if (!ok) throw new Error(`Ekart serviceability failed (HTTP ${status})`);

  // The response shape varies between Ekart API versions, so read it defensively.
  const root = asRecord(json);
  const detail =
    asRecord(root?.response) ?? asRecord(root?.data) ?? asRecord(root?.result) ?? root;
  if (!detail) throw new Error('Ekart returned an unexpected response');

  const flag =
    detail.serviceable ?? detail.isServiceable ?? detail.is_serviceable ?? detail.deliverable ?? detail.status;
  if (flag === undefined) throw new Error('Ekart response had no serviceability flag');

  const serviceable =
    typeof flag === 'string' ? ['serviceable', 'success', 'true', 'yes', '1'].includes(flag.toLowerCase()) : truthy(flag);
  if (!serviceable) return { serviceable: false, error: NOT_SERVICEABLE_MESSAGE };

  const codFlag = detail.cod ?? detail.cod_available ?? detail.codAvailable ?? detail.isCodServiceable;
  return {
    serviceable: true,
    courier: 'Ekart',
    estimatedDays: formatDays(detail.tat ?? detail.estimated_delivery_days ?? detail.estimatedDays),
    cod: codFlag === undefined ? undefined : truthy(codFlag),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkPincodeServiceability(pincode: string): Promise<ServiceabilityResult> {
  if (!isValidPincodeFormat(pincode)) {
    return { serviceable: false, error: 'Please enter a valid 6-digit pincode.' };
  }

  const hasShiprocket = Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
  const hasEkart = Boolean(process.env.EKART_API_KEY);
  if (!hasShiprocket && !hasEkart) return PASSTHROUGH;

  const cached = await readCache(pincode);
  if (cached) return cached;

  if (hasShiprocket) {
    try {
      const result = await checkShiprocket(pincode);
      await writeCache(pincode, result, 'shiprocket');
      return result;
    } catch (error) {
      console.warn('[pincode] Shiprocket check failed, trying fallback:', error);
    }
  }

  if (hasEkart) {
    try {
      const result = await checkEkart(pincode);
      await writeCache(pincode, result, 'ekart');
      return result;
    } catch (error) {
      console.warn('[pincode] Ekart check failed:', error);
    }
  }

  // Every courier failed — don't cache, and don't block checkout.
  return PASSTHROUGH;
}
