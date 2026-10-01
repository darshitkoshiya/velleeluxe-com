/**
 * Pincode delivery check (server-only — uses the Firebase Admin SDK and courier secrets).
 *
 * Order of attempts:
 *   1. Firestore cache `pincodeCache/{pincode}` (7-day TTL)
 *   2. Shiprocket (needs SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD)
 *   3. Ekart (needs EKART_TOKEN, or EKART_CLIENT_ID + EKART_USERNAME + EKART_PASSWORD, or the
 *      same credentials saved from the admin panel in Firestore `config/ekart.credentials`)
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
const EKART_DEFAULT_BASE_URL = 'https://app.elite.ekartlogistics.in';
/** Ekart tokens last ~24h; cache for 20h to be safe. */
const EKART_TOKEN_TTL_MS = 20 * 60 * 60 * 1000;
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

/**
 * Ekart credentials saved from the admin settings panel. Stored in Firestore `config/ekart`
 * under a nested `credentials` object so they never clash with the cached `token`/`expiresAt`.
 */
export interface EkartStoredCredentials {
  clientId?: string;
  username?: string;
  password?: string;
  staticToken?: string;
  baseUrl?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Reads `config/ekart.credentials` from Firestore. Returns {} if missing or unreadable. */
export async function readEkartStoredCredentials(): Promise<EkartStoredCredentials> {
  try {
    const snap = await getAdminDb().collection('config').doc('ekart').get();
    const creds = asRecord(asRecord(snap.data())?.credentials);
    if (!creds) return {};
    return {
      clientId: str(creds.clientId),
      username: str(creds.username),
      password: str(creds.password),
      staticToken: str(creds.staticToken),
      baseUrl: str(creds.baseUrl),
    };
  } catch (error) {
    console.warn('[pincode] Could not read Ekart credentials from Firestore:', error);
    return {};
  }
}

type ResolvedEkartAuth =
  | { kind: 'static'; token: string }
  | { kind: 'login'; clientId: string; username: string; password: string }
  | { kind: 'none' };

/**
 * Picks which Ekart credentials to use, in priority order:
 *   1. EKART_TOKEN env var
 *   2. Firestore credentials.staticToken
 *   3. Firestore credentials.clientId + username + password
 *   4. EKART_CLIENT_ID + EKART_USERNAME + EKART_PASSWORD env vars
 */
function resolveEkartAuth(stored: EkartStoredCredentials): ResolvedEkartAuth {
  const envToken = process.env.EKART_TOKEN?.trim();
  if (envToken) return { kind: 'static', token: envToken };
  if (stored.staticToken) return { kind: 'static', token: stored.staticToken };
  if (stored.clientId && stored.username && stored.password) {
    return { kind: 'login', clientId: stored.clientId, username: stored.username, password: stored.password };
  }
  const clientId = process.env.EKART_CLIENT_ID?.trim();
  const username = process.env.EKART_USERNAME?.trim();
  const password = process.env.EKART_PASSWORD;
  if (clientId && username && password) return { kind: 'login', clientId, username, password };
  return { kind: 'none' };
}

async function ekartBaseUrl(stored?: EkartStoredCredentials): Promise<string> {
  const creds = stored ?? (await readEkartStoredCredentials());
  return (creds.baseUrl || process.env.EKART_BASE_URL?.trim() || EKART_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function hasEnvEkartCredentials(): boolean {
  return Boolean(
    process.env.EKART_TOKEN?.trim() ||
      (process.env.EKART_CLIENT_ID && process.env.EKART_USERNAME && process.env.EKART_PASSWORD),
  );
}

function hasStoredEkartCredentials(stored: EkartStoredCredentials): boolean {
  return Boolean(stored.staticToken || (stored.clientId && stored.username && stored.password));
}

/** True if Ekart can be used — credentials in env vars OR saved in Firestore. */
async function hasEkartCredentials(): Promise<boolean> {
  if (hasEnvEkartCredentials()) return true;
  return hasStoredEkartCredentials(await readEkartStoredCredentials());
}

/** Admin-facing status. Never includes credential values — only whether they exist. */
export async function getEkartConfigStatus(): Promise<{
  configured: boolean;
  source: 'env' | 'firestore' | 'none';
  hasClientId: boolean;
  hasToken: boolean;
}> {
  const stored = await readEkartStoredCredentials();
  const auth = resolveEkartAuth(stored);
  let source: 'env' | 'firestore' | 'none' = 'none';
  if (auth.kind === 'static') {
    source = process.env.EKART_TOKEN?.trim() ? 'env' : 'firestore';
  } else if (auth.kind === 'login') {
    source = hasStoredEkartCredentials(stored) ? 'firestore' : 'env';
  }
  return {
    configured: auth.kind !== 'none',
    source,
    hasClientId: Boolean(stored.clientId || process.env.EKART_CLIENT_ID?.trim()),
    hasToken: Boolean(process.env.EKART_TOKEN?.trim() || stored.staticToken),
  };
}

/** True when the token in use is a pre-issued static token (can't be refreshed). */
async function usingStaticEkartToken(): Promise<boolean> {
  return resolveEkartAuth(await readEkartStoredCredentials()).kind === 'static';
}

/**
 * Bearer token for the Ekart API.
 *   1. Static token (EKART_TOKEN env var, then Firestore credentials.staticToken) — used as-is.
 *   2. Cached token in Firestore `config/ekart` (if not expired).
 *   3. Fresh token from POST /integrations/v2/auth/token/{clientId}, cached for 20h.
 *      clientId/username/password come from Firestore credentials first, then env vars.
 * Returns null on failure so the caller can fall back gracefully.
 */
async function getEkartToken(forceRefresh = false): Promise<string | null> {
  const stored = await readEkartStoredCredentials();
  const auth = resolveEkartAuth(stored);
  if (auth.kind === 'static') return auth.token;
  if (auth.kind === 'none') return null;
  const { clientId, username, password } = auth;

  try {
    const ref = getAdminDb().collection('config').doc('ekart');

    if (!forceRefresh) {
      try {
        const snap = await ref.get();
        const data = snap.data() as { token?: unknown; expiresAt?: unknown } | undefined;
        if (typeof data?.token === 'string' && typeof data.expiresAt === 'number' && data.expiresAt > Date.now()) {
          return data.token;
        }
      } catch (error) {
        console.warn('[pincode] Could not read cached Ekart token:', error);
      }
    }

    const { ok, status, json } = await fetchJson(
      `${await ekartBaseUrl(stored)}/integrations/v2/auth/token/${encodeURIComponent(clientId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password }),
      },
    );
    const body = asRecord(json);
    const rawToken = body?.access_token ?? body?.accessToken ?? body?.token ?? asRecord(body?.data)?.access_token;
    const token = typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '').trim() : '';
    if (!ok || !token) {
      console.warn(`[pincode] Ekart auth failed (HTTP ${status})`);
      return null;
    }

    try {
      // merge: true keeps the saved `credentials` object in the same doc.
      await ref.set({ token, expiresAt: Date.now() + EKART_TOKEN_TTL_MS, updatedAt: Date.now() }, { merge: true });
    } catch (error) {
      console.warn('[pincode] Could not store Ekart token:', error);
    }
    return token;
  } catch (error) {
    console.warn('[pincode] Ekart auth error:', error);
    return null;
  }
}

async function ekartServiceabilityRequest(pincode: string, token: string) {
  const pickupPincode = await getPickupPincode();
  return fetchJson(`${await ekartBaseUrl()}/data/v3/serviceability`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      pickupPincode,
      dropPincode: pincode,
      weight: '500',
      length: '30',
      width: '25',
      height: '5',
      paymentType: 'Prepaid',
      invoiceAmount: '999',
    }),
  });
}

/** Pulls the courier list out of the response (a bare array, or wrapped in data/couriers/etc.). */
function extractEkartCouriers(json: unknown): Record<string, unknown>[] | null {
  let list: unknown = json;
  if (!Array.isArray(list)) {
    const root = asRecord(json);
    if (!root) return null;
    const inner = asRecord(root.data);
    list = [root.data, root.couriers, root.response, root.result, inner?.couriers].find(Array.isArray);
    if (!Array.isArray(list)) return null;
  }
  return (list as unknown[]).map(asRecord).filter((c): c is Record<string, unknown> => !!c);
}

/** Builds an "x-y days" string from a courier's TAT fields. */
function ekartTat(courier: Record<string, unknown>): string | undefined {
  const tat = asRecord(courier.tat);
  const min = tat?.min ?? courier.min_tat ?? courier.tat_min ?? courier.minTat;
  const max = tat?.max ?? courier.max_tat ?? courier.tat_max ?? courier.maxTat;
  if (min !== undefined && max !== undefined && min !== null && max !== null) {
    return String(min) === String(max) ? formatDays(min) : formatDays(`${min}-${max}`);
  }
  if (min !== undefined && min !== null) return formatDays(min);
  if (max !== undefined && max !== null) return formatDays(max);
  const raw = tat ? undefined : courier.tat ?? courier.tat_range ?? courier.estimated_delivery_days;
  return formatDays(raw);
}

/**
 * Ekart serviceability via POST /data/v3/serviceability. Never throws: any failure
 * (no token, timeout, bad response) returns PASSTHROUGH so checkout is never blocked.
 */
async function checkEkartServiceability(pincode: string): Promise<ServiceabilityResult> {
  try {
    let token = await getEkartToken();
    if (!token) return PASSTHROUGH;

    let response = await ekartServiceabilityRequest(pincode, token);
    // Cached token may have been revoked early — refresh once (not possible with a static token).
    if ((response.status === 401 || response.status === 403) && !(await usingStaticEkartToken())) {
      token = await getEkartToken(true);
      if (!token) return PASSTHROUGH;
      response = await ekartServiceabilityRequest(pincode, token);
    }

    const couriers = extractEkartCouriers(response.json);
    if (!response.ok) {
      // Some APIs answer "no courier" with a 4xx and an empty list; anything else is a real failure.
      if (couriers && couriers.length === 0 && response.status !== 401 && response.status !== 403) {
        return { serviceable: false, error: NOT_SERVICEABLE_MESSAGE };
      }
      console.warn(`[pincode] Ekart serviceability failed (HTTP ${response.status})`);
      return PASSTHROUGH;
    }
    if (!couriers) {
      console.warn('[pincode] Ekart returned an unexpected response');
      return PASSTHROUGH;
    }
    if (couriers.length === 0) return { serviceable: false, error: NOT_SERVICEABLE_MESSAGE };

    const best = couriers[0];
    const name = best.courier_name ?? best.courierName ?? best.name;
    const hasCodField = couriers.some(
      (c) => c.cod !== undefined || c.cod_available !== undefined || c.is_cod !== undefined || c.codAvailable !== undefined,
    );
    return {
      serviceable: true,
      courier: typeof name === 'string' && name ? name : 'Ekart',
      estimatedDays: couriers.map(ekartTat).find((d) => !!d),
      cod: hasCodField
        ? couriers.some((c) => truthy(c.cod) || truthy(c.cod_available) || truthy(c.is_cod) || truthy(c.codAvailable))
        : undefined,
    };
  } catch (error) {
    console.warn('[pincode] Ekart check failed:', error);
    return PASSTHROUGH;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkPincodeServiceability(pincode: string): Promise<ServiceabilityResult> {
  if (!isValidPincodeFormat(pincode)) {
    return { serviceable: false, error: 'Please enter a valid 6-digit pincode.' };
  }

  const hasShiprocket = Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
  const hasEkart = await hasEkartCredentials();
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
    const result = await checkEkartServiceability(pincode);
    // PASSTHROUGH means Ekart failed — don't cache it.
    if (result !== PASSTHROUGH) {
      await writeCache(pincode, result, 'ekart');
      return result;
    }
  }

  // Every courier failed — don't cache, and don't block checkout.
  return PASSTHROUGH;
}
