/**
 * Google Sheets access (server-only).
 *
 * Products are discovered automatically:
 *   0. If GOOGLE_DRIVE_SUPPLIERS_FOLDER_ID is set → each subfolder is one
 *      supplier. Every supplier uses its own column layout, so Gemini detects
 *      which column is which (cached per sheet tab for 24 h, in memory and in
 *      the Firestore `schemaCache` collection). Problems are reported to the
 *      admin panel via lib/admin-notifications.ts.
 *      Its product sheets are read, per-size stock is merged from
 *      the sheet whose name contains "inventory" (matched on product id = SKU
 *      base), and products with no image URLs fall back to
 *      "product images/{productId}/" inside the supplier folder.
 *   1. Otherwise, if GOOGLE_DRIVE_PRODUCTS_FOLDER_ID is set → every Google Sheet inside
 *      that Drive folder is read. Add a new supplier sheet to the folder and
 *      it shows up on the next cache refresh (~60 s). No IDs to manage.
 *   2. Fallback: GOOGLE_SHEETS_SPREADSHEET_ID reads a single named spreadsheet.
 *
 * Within each spreadsheet, tabs named "Products", "Products-1", "Products-2"
 * … are all read and merged.
 *
 * "Orders" tab — a human-readable copy of every order (Firestore is the source
 * of truth). Row 1 of each tab holds headers; data starts on row 2.
 */
import { createHash } from 'crypto';
import { google, type drive_v3, type sheets_v4 } from 'googleapis';
import { unstable_cache } from 'next/cache';
import type { Order, OrderStatus, Product, ProductStatus } from './types';
import { driveImageUrl, normaliseImageUrl } from './utils';
import { getAdminDb } from './firebase-admin';
import { getStockNotFoundBehaviour, type StockNotFoundBehaviour } from './settings';
import {
  raiseNotification,
  resolveNotification,
  type AdminNotification,
  type NotificationCategory,
} from './admin-notifications';

const PRODUCTS_TAB_PATTERN = /^Products(-\d+)?$/i;
const ORDERS_ID_RANGE = 'Orders!A:A';
const ORDERS_APPEND_RANGE = 'Orders!A:P';

/** Column positions (0-based) in the Products tab. */
const COL = {
  id: 0,
  slug: 1,
  name: 2,
  description: 3,
  price: 4,
  compareAtPrice: 5,
  sizes: 6,
  style: 7,
  colour: 8,
  fit: 9,
  driveFolderId: 10,
  images: 11,
  careInstructions: 12,
  seoTitle: 13,
  seoDescription: 14,
  status: 15,
  stock: 16,
  createdAt: 17,
  updatedAt: 18,
  designId: 19,
} as const;

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    },
    // Drive read scope needed for folder discovery; Sheets for reading/writing data.
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuth() });
}

/**
 * Discovers every Google Sheet spreadsheet ID to read products from:
 *  - If GOOGLE_DRIVE_PRODUCTS_FOLDER_ID is set: lists all Sheets in that folder.
 *  - Fallback: returns GOOGLE_SHEETS_SPREADSHEET_ID as a single-element array.
 */
async function discoverSpreadsheetIds(): Promise<string[]> {
  const folderId = process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID;

  if (folderId) {
    const drive = getDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 100,
    });
    const ids = (response.data.files ?? [])
      .map((f) => f.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) return ids;
    console.warn('[sheets] Drive folder found but contains no spreadsheets.');
  }

  const fallback = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (fallback) return [fallback];

  return [];
}

/* ------------------------------------------------------------------ */
/* Row parsing                                                         */
/* ------------------------------------------------------------------ */

function cell(row: unknown[], index: number): string {
  const value = row[index];
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Parses "1,499", "₹1499", "1499.00" etc. Returns undefined when not a positive number. */
function parsePrice(raw: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, ''));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Images are stored as a JSON array, but we also accept comma/newline separated URLs. */
function parseImages(raw: string): string[] {
  if (!raw) return [];
  let urls: string[] = [];
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        urls = parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      urls = [];
    }
  }
  if (urls.length === 0) {
    urls = raw.replace(/^\[|\]$/g, '').split(/[\n,]+/).map((u) => u.replace(/["']/g, ''));
  }
  return urls.map(normaliseImageUrl).filter((url) => url.startsWith('http'));
}

function parseStatus(raw: string): ProductStatus {
  const value = raw.toLowerCase();
  if (value === 'live' || value === 'archived') return value;
  return 'draft';
}

function parseStock(raw: string): number | 'unlimited' {
  if (!raw || raw.toLowerCase() === 'unlimited') return 'unlimited';
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 'unlimited';
}

/** Converts one sheet row into a Product. Returns null for empty/invalid rows. */
function rowToProduct(row: unknown[]): Product | null {
  const id = cell(row, COL.id);
  const slug = cell(row, COL.slug);
  const name = cell(row, COL.name);
  if (!slug || !name) return null;

  const compareAtPrice = parsePrice(cell(row, COL.compareAtPrice));
  const price = parsePrice(cell(row, COL.price)) ?? 0;

  return {
    id: id || slug,
    slug,
    name,
    description: cell(row, COL.description),
    price,
    compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : undefined,
    sizes: parseList(cell(row, COL.sizes)).map((s) => s.toUpperCase()),
    style: cell(row, COL.style).toLowerCase(),
    colour: cell(row, COL.colour).toLowerCase(),
    fit: cell(row, COL.fit).toLowerCase(),
    driveFolderId: cell(row, COL.driveFolderId),
    images: parseImages(cell(row, COL.images)),
    careInstructions: cell(row, COL.careInstructions),
    seoTitle: cell(row, COL.seoTitle),
    seoDescription: cell(row, COL.seoDescription),
    status: parseStatus(cell(row, COL.status)),
    stock: parseStock(cell(row, COL.stock)),
    createdAt: cell(row, COL.createdAt),
    updatedAt: cell(row, COL.updatedAt),
    designId: cell(row, COL.designId) || undefined,
  };
}

function isLive(product: Product): boolean {
  return product.price > 0;
}

function newestFirst(a: Product, b: Product): number {
  return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

/** Returns all Products-* tab names within a single spreadsheet. */
async function getProductTabNames(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter((t) => PRODUCTS_TAB_PATTERN.test(t));
  return titles.length > 0 ? titles : ['Products'];
}

/** Reads all Products-* tabs from one spreadsheet and returns the rows. */
async function fetchFromSpreadsheet(spreadsheetId: string): Promise<Product[]> {
  const sheets = getSheetsClient();
  const tabs = await getProductTabNames(spreadsheetId);
  const responses = await Promise.all(
    tabs.map((tab) =>
      sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A2:T` }),
    ),
  );
  return responses.flatMap((r) => {
    const rows = (r.data.values ?? []) as unknown[][];
    return rows.map(rowToProduct).filter((p): p is Product => p !== null);
  });
}

/* ------------------------------------------------------------------ */
/* Supplier folders (GOOGLE_DRIVE_SUPPLIERS_FOLDER_ID)                 */
/* ------------------------------------------------------------------ */

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** Any sheet whose name contains "inventory" (case-insensitive) is the stock sheet. */
function isInventorySheetName(name: string): boolean {
  return name.toLowerCase().includes('inventory');
}
const IMAGES_FOLDER_NAME = 'product images';
const KNOWN_SIZES = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL', 'FS', 'FREE']);

interface SupplierDiscovery {
  supplierFolderId: string;
  /** Supplier folder name in Drive — shown in admin notifications. */
  supplierName: string;
  /** Sheets whose name does NOT contain "inventory". */
  productSheetIds: string[];
  /** Sheet whose name contains "inventory" (e.g. "Inventory"). */
  inventorySheetId: string | null;
  /** Folder named "product images" (case-insensitive). */
  imagesFolderId: string | null;
}

interface SizeStock {
  [size: string]: number;
}
interface InventoryMap {
  [skuBase: string]: SizeStock;
}

/** Escapes a value for use inside a single-quoted Drive query string. */
function driveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Lists every (non-trashed) file matching a Drive query, following pagination. */
async function listDriveFiles(q: string, orderBy?: string): Promise<drive_v3.Schema$File[]> {
  const drive = getDriveClient();
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const response = await drive.files.list({
      q: `${q} and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: 1000,
      orderBy,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(response.data.files ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

/** Finds every supplier subfolder and classifies its product sheets, inventory sheet and images folder. */
async function discoverSuppliers(): Promise<SupplierDiscovery[]> {
  const rootId = process.env.GOOGLE_DRIVE_SUPPLIERS_FOLDER_ID;
  if (!rootId) return [];

  const supplierFolders = await listDriveFiles(
    `'${driveQueryValue(rootId)}' in parents and mimeType='${FOLDER_MIME}'`,
  );

  const discovered = await Promise.all(
    supplierFolders
      .filter((folder): folder is drive_v3.Schema$File & { id: string } => Boolean(folder.id))
      .map(async (folder) => {
        const contents = await listDriveFiles(`'${driveQueryValue(folder.id)}' in parents`);
        const discovery: SupplierDiscovery = {
          supplierFolderId: folder.id,
          supplierName: (folder.name ?? '').trim(),
          productSheetIds: [],
          inventorySheetId: null,
          imagesFolderId: null,
        };
        for (const item of contents) {
          const name = (item.name ?? '').trim();
          if (!item.id) continue;
          if (item.mimeType === SHEET_MIME) {
            if (isInventorySheetName(name)) {
              if (discovery.inventorySheetId) {
                console.warn(`[sheets] Supplier folder "${folder.name}" has more than one inventory sheet — using the first.`);
              } else {
                discovery.inventorySheetId = item.id;
              }
            } else {
              discovery.productSheetIds.push(item.id);
            }
          } else if (item.mimeType === FOLDER_MIME && name.toLowerCase() === IMAGES_FOLDER_NAME) {
            discovery.imagesFolderId = item.id;
          }
        }
        return discovery;
      }),
  );

  return registerSuppliers(discovered);
}

const SUPPLIERS_COLLECTION = 'suppliers';

/**
 * Upserts every discovered supplier into Firestore `suppliers/{folderId}` and
 * returns only the active ones (admin can set `active: false` to hide a supplier
 * without touching Drive). Firestore failures are non-fatal: the supplier is
 * treated as active so the catalog keeps working.
 */
async function registerSuppliers(suppliers: SupplierDiscovery[]): Promise<SupplierDiscovery[]> {
  const now = new Date().toISOString();
  const results = await Promise.all(
    suppliers.map(async (supplier) => {
      const folderId = supplier.supplierFolderId;
      try {
        const ref = getAdminDb().collection(SUPPLIERS_COLLECTION).doc(folderId);
        const snapshot = await ref.get();
        const sheetFields: Record<string, string> = {};
        if (supplier.productSheetIds[0]) sheetFields.spreadsheetId = supplier.productSheetIds[0];
        if (supplier.inventorySheetId) sheetFields.inventorySpreadsheetId = supplier.inventorySheetId;

        if (!snapshot.exists) {
          await ref.set(
            {
              folderId,
              name: supplier.supplierName,
              discoveredAt: now,
              lastSeenAt: now,
              active: true,
              // Keeps auto-registered docs readable by the admin suppliers list (lib/suppliers.ts).
              driveFolderId: folderId,
              createdAt: now,
              updatedAt: now,
              ...sheetFields,
            },
            { merge: true },
          );
          return supplier;
        }

        // Existing doc: only refresh name / lastSeenAt (and sheet IDs). Never touch admin-set `active`.
        await ref.set({ folderId, name: supplier.supplierName, lastSeenAt: now, ...sheetFields }, { merge: true });
        if (snapshot.data()?.active === false) {
          console.info(`[sheets] Supplier "${supplier.supplierName}" (${folderId}) is inactive — skipping.`);
          return null;
        }
        return supplier;
      } catch (error) {
        console.warn(`[sheets] Could not register supplier "${supplier.supplierName}" (${folderId}) in Firestore:`, errorText(error));
        return supplier;
      }
    }),
  );
  return results.filter((s): s is SupplierDiscovery => s !== null);
}

/** "HK0002-SH-S" → "HK0002-SH". Strips the trailing size segment. */
function skuBase(sku: string, size: string): string {
  const parts = sku.split('-');
  if (parts.length < 2) return sku;
  const last = parts[parts.length - 1].toUpperCase();
  if (last === size || KNOWN_SIZES.has(last)) return parts.slice(0, -1).join('-');
  return sku;
}

/* ------------------------------------------------------------------ */
/* AI schema detection (supplier sheets only)                          */
/* ------------------------------------------------------------------ */

/** Column indices (0-based) detected by Gemini for one supplier sheet tab. */
interface SheetSchema {
  // Product fields — column index (0-based), or null if not found
  id: number | null; // SKU / unique product ID
  name: number | null; // product name / title
  description: number | null;
  price: number | null;
  compareAtPrice: number | null;
  sizes: number | null; // sizes column (comma-separated) — only when sizePerRow=false
  colour: number | null;
  fabric: number | null; // fabric / material / style
  images: number | null; // image URL(s), may be comma-sep or JSON array
  stock: number | null; // stock / inventory / qty column
  status: number | null; // live / draft / archived
  careInstructions: number | null;
  // Schema shape
  headerRows: number; // 1 or 2 — number of header rows before data starts
  sizePerRow: boolean; // true = each row is one product+size (tall format)
  // For inventory sheets
  inventorySku: number | null;
  inventorySize: number | null;
  inventoryQty: number | null;
  /** Extra columns not mapped to a standard field: { headerName → columnIndex } */
  extraColumns: Record<string, number>;
  /** Total number of columns detected from the header row (used to bound data reads). */
  columnCount: number;
}

const SCHEMA_COLUMN_FIELDS = [
  'id', 'name', 'description', 'price', 'compareAtPrice', 'sizes', 'colour', 'fabric',
  'images', 'stock', 'status', 'careInstructions', 'inventorySku', 'inventorySize', 'inventoryQty',
] as const;

/**
 * Detected schemas are cached for 24 h so Gemini is not called on every 60 s
 * product refresh. Two layers: an in-process Map (no Firestore read within a
 * warm server) and the Firestore `schemaCache` collection (survives cold starts).
 */
const SCHEMA_CACHE_COLLECTION = 'schemaCache';
const SCHEMA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface SchemaCacheDoc {
  spreadsheetId: string;
  tab: string;
  schema: SheetSchema;
  detectedAt: string; // ISO timestamp
}

const schemaCache = new Map<string, { schema: SheetSchema; detectedAt: string }>();

/** Wipes in-process + Firestore schema caches so next fetch re-runs Gemini detection. */
export async function clearAllSchemaCaches(): Promise<void> {
  schemaCache.clear();
  try {
    const db = getAdminDb();
    const snap = await db.collection(SCHEMA_CACHE_COLLECTION).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  } catch {
    // Firestore unavailable — in-process cache was already cleared above.
  }
}

function isFresh(detectedAt: string): boolean {
  const time = Date.parse(detectedAt);
  return Number.isFinite(time) && Date.now() - time < SCHEMA_CACHE_TTL_MS;
}

function schemaCacheDocId(spreadsheetId: string, tab: string): string {
  return Buffer.from(`${spreadsheetId}::${tab}`).toString('base64url');
}

/** Reads a fresh cached schema from Firestore, or null (missing, stale, or Firestore unavailable). */
async function readSchemaFromFirestore(
  spreadsheetId: string,
  tab: string,
): Promise<{ schema: SheetSchema; detectedAt: string } | null> {
  try {
    const doc = await getAdminDb().collection(SCHEMA_CACHE_COLLECTION).doc(schemaCacheDocId(spreadsheetId, tab)).get();
    if (!doc.exists) return null;
    const data = doc.data() as Partial<SchemaCacheDoc> | undefined;
    if (!data || typeof data.detectedAt !== 'string' || !isFresh(data.detectedAt)) return null;
    return { schema: normaliseSchema(data.schema), detectedAt: data.detectedAt };
  } catch (error) {
    console.error(`[sheets] Could not read schema cache for "${tab}" in ${spreadsheetId}:`, error);
    return null;
  }
}

/** Fire-and-forget: a failed Firestore write only means Gemini runs again next time. */
function writeSchemaToFirestore(spreadsheetId: string, tab: string, schema: SheetSchema, detectedAt: string): void {
  try {
    const record: SchemaCacheDoc = { spreadsheetId, tab, schema, detectedAt };
    getAdminDb()
      .collection(SCHEMA_CACHE_COLLECTION)
      .doc(schemaCacheDocId(spreadsheetId, tab))
      .set(record)
      .catch((error) => console.error(`[sheets] Could not save schema cache for "${tab}" in ${spreadsheetId}:`, error));
  } catch (error) {
    console.error(`[sheets] Could not save schema cache for "${tab}" in ${spreadsheetId}:`, error);
  }
}

/* ------------------------------------------------------------------ */
/* Admin notifications (fire-and-forget — never break product loading) */
/* ------------------------------------------------------------------ */

function notify(n: Omit<AdminNotification, 'id' | 'createdAt' | 'updatedAt' | 'resolved'>): void {
  try {
    raiseNotification(n).catch((error) => console.error('[sheets] Could not save admin notification:', error));
  } catch (error) {
    console.error('[sheets] Could not save admin notification:', error);
  }
}

function clearNotification(category: NotificationCategory, spreadsheetId?: string): void {
  try {
    resolveNotification(category, spreadsheetId).catch((error) =>
      console.error('[sheets] Could not resolve admin notification:', error),
    );
  } catch (error) {
    console.error('[sheets] Could not resolve admin notification:', error);
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_SCHEMA_TIMEOUT_MS = 20_000;
const MAX_COLUMNS = 99; // supports sheets wider than Z (up to ~column CU)

function emptySchema(): SheetSchema {
  return {
    id: null, name: null, description: null, price: null, compareAtPrice: null, sizes: null,
    colour: null, fabric: null, images: null, stock: null, status: null, careInstructions: null,
    headerRows: 2, sizePerRow: false, inventorySku: null, inventorySize: null, inventoryQty: null,
    extraColumns: {}, columnCount: 0,
  };
}

/** Quotes a tab name for use in an A1 range, e.g. My Tab → 'My Tab'. Omit range to read all columns. */
function tabRange(tab: string, range?: string): string {
  const escaped = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${escaped}!${range}` : escaped;
}

/** Converts 1-based column number to letter(s): 1→A, 26→Z, 27→AA, 28→AB. */
function colLetter(n: number): string {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result || 'A';
}

/** Coerces Gemini's raw JSON into a safe SheetSchema (bad indices become null). */
function normaliseSchema(raw: unknown): SheetSchema {
  const schema = emptySchema();
  if (!raw || typeof raw !== 'object') return schema;
  const obj = raw as Record<string, unknown>;
  for (const field of SCHEMA_COLUMN_FIELDS) {
    const value = typeof obj[field] === 'string' ? Number(obj[field]) : obj[field];
    schema[field] =
      typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_COLUMNS ? value : null;
  }
  schema.sizePerRow = obj.sizePerRow === true || obj.sizePerRow === 'true';
  const hr = typeof obj.headerRows === 'string' ? Number(obj.headerRows) : obj.headerRows;
  schema.headerRows = typeof hr === 'number' && (hr === 1 || hr === 2) ? hr : 1;
  if (obj.extraColumns && typeof obj.extraColumns === 'object') {
    for (const [k, v] of Object.entries(obj.extraColumns as Record<string, unknown>)) {
      const idx = typeof v === 'number' ? v : Number(v);
      if (Number.isInteger(idx) && idx >= 0) schema.extraColumns[k] = idx;
    }
  }
  const cc = typeof obj.columnCount === 'number' ? obj.columnCount : Number(obj.columnCount);
  if (Number.isInteger(cc) && cc > 0) schema.columnCount = cc;
  return schema;
}

/** Asks Gemini which column holds which field (fallback when ANTHROPIC_API_KEY is not set). */
async function callGeminiForSchema(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(GEMINI_SCHEMA_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  const cleaned = text.replace(/\/\/[^\n]*/g, '').trim();
  const parsed: unknown = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/** Asks Claude (Haiku) which column holds which field via the Anthropic Messages API. */
async function callClaudeForSchema(apiKey: string, prompt: string): Promise<unknown> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(GEMINI_SCHEMA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Claude HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
  // Extract JSON from response — Claude may wrap it in markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = jsonMatch ? jsonMatch[1] : text;
  const cleaned = raw.replace(/\/\/[^\n]*/g, '').trim();
  const parsed: unknown = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/**
 * Detects which column holds which field in a supplier sheet tab, using Gemini.
 * Order: in-process Map → Firestore `schemaCache` (fresh < 24 h) → Gemini.
 * Falls back to an all-null schema (not cached, so it is retried next refresh)
 * when Gemini is unavailable or the answer can't be parsed. Throws only when
 * Google Sheets itself can't be read.
 */
async function detectSheetSchema(
  spreadsheetId: string,
  tab: string,
  purpose: 'products' | 'inventory',
  supplierName?: string,
): Promise<SheetSchema> {
  // 1. In-process cache.
  const cacheKey = `${spreadsheetId}:${tab}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && isFresh(cached.detectedAt)) return cached.schema;

  // 2. Firestore cache (survives cold starts).
  const stored = await readSchemaFromFirestore(spreadsheetId, tab);
  if (stored) {
    schemaCache.set(cacheKey, stored);
    return stored.schema;
  }

  // 3. Read header rows and detect columns by keyword matching (free, no AI needed).
  let values: unknown[][];
  try {
    const response = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range: tabRange(tab, 'A1:AZ10'),
    });
    values = (response.data.values ?? []) as unknown[][];
  } catch (error) {
    console.error(`[sheets] Could not read "${tab}" in ${spreadsheetId} for schema detection:`, error);
    throw error;
  }

  try {
    const row1 = (values[0] ?? []).map((v) => String(v ?? '').trim());
    const row2 = (values[1] ?? []).map((v) => String(v ?? '').trim());
    if (row1.length === 0) {
      console.warn(`[sheets] Tab "${tab}" in ${spreadsheetId} has no header row.`);
      notify({
        type: 'warning',
        category: 'schema_detection_failed',
        title: 'Supplier sheet has no header row',
        message: `Tab "${tab}" is empty or row 1 has no column names, so its columns could not be detected.`,
        supplierName,
        spreadsheetId,
      });
      return emptySchema();
    }

    // Rows 1+2 are always headers — merge them so "Product\nName" style splits resolve correctly.
    const headers = row1.map((h, i) => `${h} ${row2[i] ?? ''}`.trim().toLowerCase());

    const schema = detectSchemaFromHeaders(headers, purpose, 2);
    const detectedAt = new Date().toISOString();
    schemaCache.set(cacheKey, { schema, detectedAt });
    writeSchemaToFirestore(spreadsheetId, tab, schema, detectedAt);

    if (purpose === 'products' && schema.id === null && schema.name === null) {
      notify({
        type: 'warning',
        category: 'schema_detection_failed',
        title: 'Could not recognise supplier sheet columns',
        message: `Could not find a product ID or product name column in tab "${tab}". Headers found: ${row1.filter(Boolean).join(', ')}`,
        supplierName,
        spreadsheetId,
      });
    } else {
      clearNotification('schema_detection_failed', spreadsheetId);
    }
    return schema;
  } catch (error) {
    console.error(`[sheets] Schema detection failed for "${tab}" in ${spreadsheetId}:`, error);
    notify({
      type: 'error',
      category: 'schema_detection_failed',
      title: 'Column detection failed',
      message: `Could not map columns of tab "${tab}": ${errorText(error)}. It will retry on the next refresh.`,
      supplierName,
      spreadsheetId,
    });
    return emptySchema();
  }
}

/**
 * Maps header strings to SheetSchema column indices using keyword matching.
 * Handles common supplier header formats without any AI API calls.
 */
function detectSchemaFromHeaders(headers: string[], purpose: 'products' | 'inventory', headerRows: number): SheetSchema {
  const schema = emptySchema();
  schema.headerRows = headerRows;
  schema.columnCount = headers.length;

  const match = (patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
      const idx = headers.findIndex((h) => pattern.test(h));
      if (idx !== -1) return idx;
    }
    return null;
  };

  if (purpose === 'products') {
    schema.id = match([/\b(sku|style[\s_-]?code|item[\s_-]?code|product[\s_-]?id|article[\s_-]?no|art\.?\s*no|ref\.?\s*no)\b/i]);
    schema.name = match([/\b(product[\s_-]?name|item[\s_-]?name|name|title|description[\s_-]?1|article[\s_-]?name)\b/i]);
    schema.description = match([/\b(description|details|product[\s_-]?desc|about|notes)\b/i]);
    schema.price = match([/\b(sp|selling[\s_-]?price|sale[\s_-]?price|offer[\s_-]?price|our[\s_-]?price|price)\b/i]);
    schema.compareAtPrice = match([/\b(mrp|m\.r\.p|compare[\s_-]?at|original[\s_-]?price|list[\s_-]?price|retail[\s_-]?price|market[\s_-]?price)\b/i]);
    schema.sizes = match([/\b(sizes?|available[\s_-]?sizes?|size[\s_-]?options?)\b/i]);
    schema.colour = match([/\b(colou?r|shade|hue)\b/i]);
    schema.fabric = match([/\b(fabric|material|composition|cloth|textile)\b/i]);
    schema.images = match([/\b(images?|image[\s_-]?url|photo|picture|img|drive[\s_-]?link|google[\s_-]?drive)\b/i]);
    schema.stock = match([/\b(stock|qty|quantity|inventory|available[\s_-]?qty|total[\s_-]?stock)\b/i]);
    schema.status = match([/\b(status|live|active|visibility)\b/i]);
    schema.careInstructions = match([/\b(care|wash|washing|care[\s_-]?instructions?|laundry)\b/i]);

    // Detect size-per-row: if there's a size column AND an id column that repeats (typical tall format)
    const sizeHeader = schema.sizes !== null ? headers[schema.sizes] : '';
    schema.sizePerRow = /\b(size|variant)\b/i.test(sizeHeader) && schema.id !== null;
  } else {
    // Inventory sheet
    schema.inventorySku = match([/\b(sku|style[\s_-]?code|item[\s_-]?code|product[\s_-]?id|article[\s_-]?no)\b/i]);
    schema.inventorySize = match([/\b(size|variant|option)\b/i]);
    schema.inventoryQty = match([/\b(qty|quantity|stock|inventory|count|available)\b/i]);
  }

  // Collect any column not already mapped to a standard field as an extra attribute.
  const usedIndices = new Set(
    [schema.id, schema.name, schema.description, schema.price, schema.compareAtPrice,
     schema.sizes, schema.colour, schema.fabric, schema.images, schema.stock,
     schema.status, schema.careInstructions, schema.inventorySku, schema.inventorySize, schema.inventoryQty]
    .filter((v): v is number => v !== null),
  );
  const SKIP_HEADERS = /^(sr\.?\s*(no\.?|#?)|s\.no|#|sl\.?\s*no|serial|row|index|no\.?)$/i;
  headers.forEach((header, idx) => {
    if (header && !usedIndices.has(idx) && !SKIP_HEADERS.test(header)) {
      schema.extraColumns[header] = idx;
    }
  });

  console.log(`[sheets] Detected schema: name=${schema.name}, price=${schema.price}, id=${schema.id}, images=${schema.images}, extras=[${Object.keys(schema.extraColumns).join(', ')}]`);
  return schema;
}

/* ------------------------------------------------------------------ */
/* Dynamic row parsing (supplier sheets)                               */
/* ------------------------------------------------------------------ */

/** Reads a cell by schema index; '' when the column was not detected. */
function schemaCell(row: unknown[], index: number | null): string {
  return index === null ? '' : cell(row, index);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Supplier status words → ProductStatus. A sheet without a status column counts as live. */
function parseSupplierStatus(raw: string, hasColumn: boolean): ProductStatus {
  const value = raw.trim().toLowerCase();
  if (!hasColumn || !value) return 'live';
  if (value === 'live' || value === 'active' || value === 'published' || value === 'yes') return 'live';
  if (value === 'archived' || value === 'inactive' || value === 'discontinued') return 'archived';
  return 'draft';
}

/** Parses a quantity cell ("1,200", "12") into a non-negative integer, or undefined. */
function parseQty(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

/** Fields shared by the wide and tall parsers, taken from one row. */
function baseProductFromRow(row: unknown[], schema: SheetSchema, id: string): Product | null {
  const name = schemaCell(row, schema.name);
  if (!name) return null;
  const productId = id || slugify(name);
  if (!productId) return null;

  const price = parsePrice(schemaCell(row, schema.price)) ?? 0;
  const compareAtPrice = parsePrice(schemaCell(row, schema.compareAtPrice));
  const now = new Date().toISOString();

  return {
    id: productId,
    slug: slugify(productId),
    name,
    description: schemaCell(row, schema.description),
    price,
    compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : undefined,
    sizes: [],
    style: schemaCell(row, schema.fabric).toLowerCase(),
    colour: schemaCell(row, schema.colour).toLowerCase(),
    fit: '',
    driveFolderId: '',
    images: parseImages(schemaCell(row, schema.images)),
    careInstructions: schemaCell(row, schema.careInstructions),
    seoTitle: '',
    seoDescription: '',
    status: parseSupplierStatus(schemaCell(row, schema.status), schema.status !== null),
    stock: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Wide format: one row = one product. Returns null for empty/invalid rows. */
function rowToProductDynamic(row: unknown[], schema: SheetSchema, _allRows: unknown[][]): Product | null {
  const product = baseProductFromRow(row, schema, schemaCell(row, schema.id));
  if (!product) return null;
  const attributes: Record<string, string> = {};
  for (const [header, idx] of Object.entries(schema.extraColumns)) {
    const value = schemaCell(row, idx).trim();
    if (value) attributes[header] = value;
  }
  return {
    ...product,
    sizes: parseList(schemaCell(row, schema.sizes)).map((s) => s.toUpperCase()),
    stock: schema.stock === null ? 'unlimited' : parseStock(schemaCell(row, schema.stock)),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

/** Size of one tall-format row: size column, else the trailing SKU segment if it looks like a size. */
function rowSize(row: unknown[], schema: SheetSchema): string {
  const explicit = (schemaCell(row, schema.sizes) || schemaCell(row, schema.inventorySize)).toUpperCase();
  if (explicit) return explicit;
  const last = schemaCell(row, schema.id).split('-').pop()?.toUpperCase() ?? '';
  return KNOWN_SIZES.has(last) ? last : '';
}

/**
 * Tall format: groups consecutive rows by product ID. Empty ID cells inherit the
 * previous ID (merged-cell pattern). Size-suffixed SKUs ("HK0002-SH-S") are
 * grouped by their base ("HK0002-SH"). No ID column → all rows are one product.
 */
function groupRowsByProductId(rows: unknown[][], schema: SheetSchema): { id: string; rows: unknown[][] }[] {
  if (schema.id === null) return rows.length > 0 ? [{ id: '', rows }] : [];

  const groups = new Map<string, unknown[][]>();
  let currentId = '';
  for (const row of rows) {
    const raw = schemaCell(row, schema.id);
    if (raw) currentId = skuBase(raw, rowSize(row, schema));
    if (!currentId) continue;
    const group = groups.get(currentId);
    if (group) group.push(row);
    else groups.set(currentId, [row]);
  }
  return Array.from(groups, ([id, groupRows]) => ({ id, rows: groupRows }));
}

/** Tall format: one group of rows (one per size) → one Product. */
function rowGroupToProduct(group: { id: string; rows: unknown[][] }, schema: SheetSchema): Product | null {
  // Base data from the first row that has a name.
  const baseRow = group.rows.find((row) => schemaCell(row, schema.name)) ?? group.rows[0];
  if (!baseRow) return null;
  const product = baseProductFromRow(baseRow, schema, group.id);
  if (!product) return null;

  const qtyColumn = schema.stock ?? schema.inventoryQty;
  const sizes: string[] = [];
  const stockBySize: Record<string, number> = {};
  let images = product.images;

  for (const row of group.rows) {
    const size = rowSize(row, schema);
    if (size && !sizes.includes(size)) sizes.push(size);
    if (size && qtyColumn !== null) {
      const qty = parseQty(schemaCell(row, qtyColumn));
      if (qty !== undefined) stockBySize[size] = (stockBySize[size] ?? 0) + qty;
    }
    if (images.length === 0) images = parseImages(schemaCell(row, schema.images));
  }

  const hasSizeStock = Object.keys(stockBySize).length > 0;
  const attributes: Record<string, string> = {};
  for (const [header, idx] of Object.entries(schema.extraColumns)) {
    const value = schemaCell(baseRow, idx).trim();
    if (value) attributes[header] = value;
  }
  return {
    ...product,
    sizes,
    images,
    stock: hasSizeStock ? Object.values(stockBySize).reduce((sum, n) => sum + n, 0) : 'unlimited',
    ...(hasSizeStock ? { stockBySize } : {}),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

/** Tabs to read from a supplier product sheet: Products-* tabs if any, otherwise the first tab. */
async function getSupplierProductTabs(spreadsheetId: string): Promise<string[]> {
  const meta = await getSheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
  const productTabs = titles.filter((t) => PRODUCTS_TAB_PATTERN.test(t));
  if (productTabs.length > 0) return productTabs;
  return titles.length > 0 ? [titles[0]] : [];
}

/**
 * Reads a supplier's inventory sheet into { skuBase: { size: qty } }.
 * Column positions are detected by Gemini. Uses the "Sheet1" tab if present,
 * otherwise the first tab.
 */
async function fetchInventoryMap(spreadsheetId: string, supplierName?: string): Promise<InventoryMap> {
  const meta = await getSheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
  const tab = titles.includes('Sheet1') ? 'Sheet1' : titles[0];
  if (!tab) return {};

  const schema = await detectSheetSchema(spreadsheetId, tab, 'inventory', supplierName);
  const skuCol = schema.inventorySku ?? schema.id;
  const sizeCol = schema.inventorySize ?? schema.sizes;
  const qtyCol = schema.inventoryQty ?? schema.stock;
  if (skuCol === null || qtyCol === null) {
    console.warn(
      `[sheets] Could not detect SKU/qty columns in inventory sheet ${spreadsheetId} ("${tab}") — stock falls back to the "When stock can't be found" setting.`,
    );
    notify({
      type: 'warning',
      category: 'inventory_columns_missing',
      title: 'Inventory sheet columns not recognised',
      message: `The inventory sheet (tab "${tab}") was found, but its ${skuCol === null ? 'SKU' : 'quantity'} column could not be identified. Stock for this supplier falls back to the "When stock can't be found" setting.`,
      supplierName,
      spreadsheetId,
    });
    return {};
  }
  clearNotification('inventory_columns_missing', spreadsheetId);
  if (sizeCol === null) {
    console.warn(`[sheets] No size column detected in inventory sheet ${spreadsheetId} — using the SKU suffix as size.`);
  }

  const dataRange = schema.columnCount > 0
    ? tabRange(tab, `A3:${colLetter(schema.columnCount)}`)
    : tabRange(tab);
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: dataRange,
  });
  const rows = (response.data.values ?? []) as unknown[][];
  const map: InventoryMap = {};
  for (const row of rows) {
    const sku = cell(row, skuCol);
    const qty = parseQty(cell(row, qtyCol));
    if (!sku || qty === undefined) continue;

    const sizeCell = schemaCell(row, sizeCol).toUpperCase();
    const size = sizeCell || sku.split('-').pop()!.toUpperCase();
    const base = skuBase(sku, size);

    const entry = (map[base] ??= {});
    entry[size] = (entry[size] ?? 0) + qty;
  }
  return map;
}

/**
 * Applies per-size stock from the inventory map; total stock becomes the sum across sizes.
 * Products absent from the inventory sheet whose own sheet gave no stock ('unlimited' = unknown)
 * follow the admin setting: 'sold_out' → 0, 'unlimited' → stays purchasable.
 */
function mergeStock(product: Product, inventoryMap: InventoryMap, stockNotFound: StockNotFoundBehaviour): Product {
  const sizeStock = inventoryMap[product.id];
  if (!sizeStock) {
    if (product.stock !== 'unlimited') return product;
    return stockNotFound === 'unlimited' ? product : { ...product, stock: 0 };
  }
  const totalStock = Object.values(sizeStock).reduce((sum, n) => sum + n, 0);
  return {
    ...product,
    stockBySize: sizeStock,
    stock: totalStock, // aggregate for backward-compat (soldOut check, etc.)
  };
}

/**
 * Sheet image URLs win. Otherwise looks for "product images/{product.id}/"
 * in the supplier folder and returns its images, sorted by file name.
 */
async function resolveProductImages(product: Product, imagesFolderId: string | null): Promise<string[]> {
  if (product.images.length > 0) return product.images;
  if (!imagesFolderId || !product.id) return [];

  const subfolders = await listDriveFiles(
    `'${driveQueryValue(imagesFolderId)}' in parents and mimeType='${FOLDER_MIME}' and name='${driveQueryValue(product.id)}'`,
  );
  const folderId = subfolders[0]?.id;
  if (!folderId) return [];

  const files = await listDriveFiles(
    `'${driveQueryValue(folderId)}' in parents and mimeType contains 'image/'`,
  );
  return files
    .filter((f): f is drive_v3.Schema$File & { id: string } => Boolean(f.id) && (f.mimeType ?? '').startsWith('image/'))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }))
    .map((f) => driveImageUrl(f.id));
}

/* ------------------------------------------------------------------ */
/* AI product copy (Gemini) — cached in Firestore `productCopy/{id}`   */
/* ------------------------------------------------------------------ */

const PRODUCT_COPY_COLLECTION = 'productCopy';
const GEMINI_COPY_TIMEOUT_MS = 15_000;
/** Max simultaneous Gemini copy calls across the whole sync (avoids 429s on a first full sync). */
const GEMINI_COPY_CONCURRENCY = 5;

let copySlotsInUse = 0;
const copySlotQueue: (() => void)[] = [];

async function withCopySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (copySlotsInUse >= GEMINI_COPY_CONCURRENCY) {
    await new Promise<void>((resolve) => copySlotQueue.push(resolve));
  } else {
    copySlotsInUse++;
  }
  try {
    return await fn();
  } finally {
    const next = copySlotQueue.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else copySlotsInUse--;
  }
}

/** Firestore doc IDs cannot contain "/". */
function productCopyDocId(id: string): string {
  return id.replace(/\//g, '_').slice(0, 1500) || '_';
}

/** Hash of the raw supplier fields the copy is generated from. Changes → copy is regenerated. */
function rawCopyHash(product: Product): string {
  return createHash('md5').update(`${product.name}|${product.style}|${product.colour}`).digest('hex');
}

function buildCopyPrompt(product: Product): string {
  const field = (value: string) => value.trim() || 'not specified';
  const extras = Object.entries(product.attributes ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return `You are a product copywriter for Vellee Luxe, a premium Indian men's clothing brand. Generate a product name and description for this clothing item.

Raw supplier data:
- Raw name/title: ${field(product.name)}
- Fabric/material: ${field(product.style)}
- Colour: ${field(product.colour)}
- SKU: ${field(product.id)}
${product.description.trim() ? `- Raw description: ${product.description.trim().slice(0, 300)}\n` : ''}${extras ? `${extras}\n` : ''}
Rules:
- Name: 3-6 words, premium and specific (e.g. "Slim Cotton Oxford Shirt"). No brand name.
- Description: 2-3 sentences. Mention fabric, fit, and occasion naturally. Confident, editorial tone. No marketing filler.
- Use ALL the supplier data above to write something specific, not generic.
- Respond with ONLY valid JSON: {"name": "...", "description": "..."}`;
}

async function callGeminiForCopy(apiKey: string, model: string, prompt: string): Promise<{ name: string; description: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_COPY_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
            // gemini-2.5 models spend output tokens on "thinking" by default; disable so 300 is enough for the JSON.
            ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, unknown>;
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
    if (!name || !description) throw new Error('Gemini response is missing "name" or "description".');
    return { name: name.slice(0, 120), description: description.slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Replaces the supplier's raw name/description with AI-written copy.
 * Cached in Firestore `productCopy/{id}`; regenerated only when the raw name/fabric/colour change.
 * Never throws — on any failure the product is returned unchanged.
 */
async function applyAICopy(product: Product): Promise<Product> {
  try {
    const rawNameHash = rawCopyHash(product);
    const ref = getAdminDb().collection(PRODUCT_COPY_COLLECTION).doc(productCopyDocId(product.id));

    try {
      const cached = (await ref.get()).data();
      if (
        cached &&
        cached.rawNameHash === rawNameHash &&
        typeof cached.name === 'string' &&
        typeof cached.description === 'string' &&
        cached.name &&
        cached.description
      ) {
        return { ...product, name: cached.name, description: cached.description };
      }
    } catch (error) {
      console.warn(`[sheets] productCopy read failed for ${product.id}:`, errorText(error));
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return product;
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

    const copy = await withCopySlot(() => callGeminiForCopy(apiKey, model, buildCopyPrompt(product)));
    try {
      await ref.set({ ...copy, generatedAt: new Date().toISOString(), rawNameHash });
    } catch (error) {
      console.warn(`[sheets] productCopy write failed for ${product.id}:`, errorText(error));
    }
    return { ...product, name: copy.name, description: copy.description };
  } catch (error) {
    console.warn(`[sheets] AI copy failed for ${product.id} — keeping supplier name/description:`, errorText(error));
    return product;
  }
}

/** Parses one supplier tab's data rows according to its detected schema. */
function parseSupplierRows(rows: unknown[][], schema: SheetSchema): Product[] {
  if (schema.sizePerRow) {
    const groups = groupRowsByProductId(rows, schema);
    return groups.map((group) => rowGroupToProduct(group, schema)).filter((p): p is Product => p !== null);
  }
  return rows.map((row) => rowToProductDynamic(row, schema, rows)).filter((p): p is Product => p !== null);
}

/**
 * Reads one supplier product spreadsheet using AI-detected columns, merges
 * per-size stock and resolves folder images. Products with no images are dropped.
 */
async function fetchSupplierProducts(
  spreadsheetId: string,
  imagesFolderId: string | null,
  inventoryMap: InventoryMap,
  stockNotFound: StockNotFoundBehaviour,
  supplierName?: string,
): Promise<Product[]> {
  const sheets = getSheetsClient();
  const tabs = await getSupplierProductTabs(spreadsheetId);

  const perTab = await Promise.all(
    tabs.map(async (tab) => {
      const schema = await detectSheetSchema(spreadsheetId, tab, 'products', supplierName);
      if (schema.name === null) {
        console.warn(`[sheets] No product-name column detected in "${tab}" of ${spreadsheetId} — skipping tab.`);
        return [];
      }
      const dataRange = schema.columnCount > 0
        ? tabRange(tab, `A3:${colLetter(schema.columnCount)}`)
        : tabRange(tab, 'A3:AZ');
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: dataRange });
      const rows = (response.data.values ?? []) as unknown[][];
      return parseSupplierRows(rows, schema);
    }),
  );

  // Products whose stock was found neither in their own sheet nor in the inventory sheet.
  const rawProducts = perTab.flat();
  const missingStock = rawProducts.filter((p) => p.stock === 'unlimited' && !inventoryMap[p.id]).length;
  if (missingStock > 0) {
    notify({
      type: 'warning',
      category: 'stock_not_found',
      title: 'Stock not found for some products',
      message: `${missingStock} of ${rawProducts.length} product${rawProducts.length === 1 ? '' : 's'} in this sheet have no stock column value and no inventory row. They are shown as ${stockNotFound === 'unlimited' ? 'available (unlimited)' : 'sold out'} per the "When stock can't be found" setting.`,
      supplierName,
      spreadsheetId,
    });
  } else if (rawProducts.length > 0) {
    clearNotification('stock_not_found', spreadsheetId);
  }

  const resolved = await Promise.all(
    rawProducts.map(async (raw) => {
      const product = mergeStock(raw, inventoryMap, stockNotFound);
      let images = product.images;
      try {
        images = await resolveProductImages(product, imagesFolderId);
      } catch (error) {
        console.error(`[sheets] Failed to resolve images for product ${product.id}:`, error);
      }
      return images === product.images ? product : { ...product, images };
    }),
  );
  const noImages = resolved.filter((p) => p.images.length === 0);
  if (noImages.length > 0) {
    console.warn(`[sheets] ${noImages.length} product(s) have no images yet — they will still be listed. Add image URLs to the sheet or a "product images/{id}/" subfolder in Drive.`);
  }
  console.log(`[sheets] ${resolved.length} product(s) parsed from ${spreadsheetId} (${resolved.length - noImages.length} with images, ${noImages.length} without).`);

  // Generate AI copy once per parent SKU (size variants share it) to save Gemini calls.
  const groups = new Map<string, Product[]>();
  for (const p of resolved) {
    const key = getParentKey(p.id);
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }

  const grouped = await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      const [parent, ...children] = group;
      const withCopy = await applyAICopy(parent).catch(() => parent);
      return [
        withCopy,
        ...children.map((child) => ({ ...child, name: withCopy.name, description: withCopy.description })),
      ];
    }),
  );
  return grouped.flat();
}

/** Strips a trailing size suffix (e.g. "ABC-XL", "ABC/32") to get the parent SKU key. */
function getParentKey(id: string): string {
  return id.replace(/[-\/](?:XS|S|M|L|XL|XXL|2XL|3XL)$/i, '').trim();
}

/** Reads every product sheet of one supplier folder, sharing that supplier's inventory map. */
async function fetchSupplier(supplier: SupplierDiscovery, stockNotFound: StockNotFoundBehaviour): Promise<Product[]> {
  const { supplierName } = supplier;
  const sheetUnreadable = (spreadsheetId: string, what: string, error: unknown) =>
    notify({
      type: 'error',
      category: 'sheet_unreadable',
      title: `A supplier ${what} could not be read`,
      message: `Google Sheets returned an error: ${errorText(error)}. Check the sheet still exists and is shared with the service account.`,
      supplierName,
      spreadsheetId,
    });

  let inventoryMap: InventoryMap = {};
  if (supplier.inventorySheetId) {
    const inventoryId = supplier.inventorySheetId;
    try {
      inventoryMap = await fetchInventoryMap(inventoryId, supplierName);
      clearNotification('sheet_unreadable', inventoryId);
    } catch (error) {
      console.error(`[sheets] Failed to read inventory sheet ${inventoryId}:`, error);
      sheetUnreadable(inventoryId, 'inventory sheet', error);
    }
  }

  const lists = await Promise.all(
    supplier.productSheetIds.map(async (id) => {
      try {
        const products = await fetchSupplierProducts(id, supplier.imagesFolderId, inventoryMap, stockNotFound, supplierName);
        clearNotification('sheet_unreadable', id);
        return products;
      } catch (error) {
        console.error(`[sheets] Failed to read supplier product sheet ${id}:`, error);
        sheetUnreadable(id, 'product sheet', error);
        return [] as Product[];
      }
    }),
  );
  // Supplier docs in Firestore are keyed by the Drive folder ID (see registerSuppliers).
  const products = lists.flat().map((product) => ({ ...product, supplierId: supplier.supplierFolderId }));

  // Keyed by the supplier's Drive folder ID (one alert per supplier).
  const liveCount = products.filter(isLive).length;
  if (liveCount === 0) {
    notify({
      type: 'warning',
      category: 'supplier_empty',
      title: 'Supplier has no products on the site',
      message:
        supplier.productSheetIds.length === 0
          ? 'This supplier folder has no product sheet.'
          : 'No product from this supplier is showing. Products need a name, a price above 0 and at least one image.',
      supplierName,
      spreadsheetId: supplier.supplierFolderId,
    });
  } else {
    clearNotification('supplier_empty', supplier.supplierFolderId);
  }
  return products;
}

async function fetchAllProductRows(): Promise<Product[]> {
  if (process.env.GOOGLE_DRIVE_SUPPLIERS_FOLDER_ID) {
    // Read once per refresh (cached in lib/settings.ts); defaults to 'sold_out' if Firestore is unavailable.
    const stockNotFound = await getStockNotFoundBehaviour();
    const suppliers = await discoverSuppliers();
    const results = await Promise.all(suppliers.map((supplier) => fetchSupplier(supplier, stockNotFound)));
    return results.flat();
  }

  // Legacy path: single products folder / single spreadsheet. No stock merge, no image folder fallback.
  const ids = await discoverSpreadsheetIds();
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map(fetchFromSpreadsheet));
  return results.flat();
}

/**
 * Cached for 3 hours so we stay well within the Sheets API quota. The admin
 * "Sync Products Now" button (POST /api/admin/sync) busts this cache on demand.
 * Errors are thrown (and therefore not cached) so the next request retries.
 */
const fetchAllProductsCached = unstable_cache(fetchAllProductRows, ['vl-sheet-products'], {
  revalidate: 10800,
  tags: ['products', 'catalog'],
});

/** Every product row, including drafts and archived ones. */
async function getAllProducts(): Promise<Product[]> {
  if (!isGoogleConfigured()) {
    console.warn('[sheets] Google credentials not configured — returning no products.');
    return [];
  }
  try {
    return await fetchAllProductsCached();
  } catch (error) {
    console.error('[sheets] Failed to load products:', error);
    return [];
  }
}

/** Live products only (price > 0), newest first. */
export async function getProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(isLive).sort(newestFirst);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const wanted = new Set(ids);
  const products = await getProducts();
  return products.filter((product) => wanted.has(product.id));
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/** Orders are written to the single spreadsheet named by GOOGLE_SHEETS_SPREADSHEET_ID. */
function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && isGoogleConfigured());
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set.');
  return id;
}

function orderToRow(order: Order): string[] {
  return [
    order.orderId,
    order.customerId,
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    JSON.stringify(order.shippingAddress),
    JSON.stringify(order.items),
    String(order.subtotal),
    String(order.total),
    order.paymentMethod,
    order.razorpayOrderId ?? '',
    order.razorpayPaymentId ?? '',
    order.status,
    order.createdAt,
    order.updatedAt,
    order.notes ?? '',
  ];
}

/** Adds an order as a new row at the bottom of the Orders tab. */
export async function appendOrder(order: Order): Promise<void> {
  if (!isSheetsConfigured()) {
    console.warn('[sheets] Google Sheets is not configured — order not copied to sheet.');
    return;
  }
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: ORDERS_APPEND_RANGE,
    // RAW stops customer-typed text such as "=HYPERLINK(...)" being run as a formula.
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [orderToRow(order)] },
  });
}

export interface OrderSheetUpdate {
  status?: OrderStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  updatedAt?: string;
}

/** Updates status / payment columns for an existing order row (matched by order ID in column A). */
export async function updateOrderInSheet(orderId: string, updates: OrderSheetUpdate): Promise<void> {
  if (!isSheetsConfigured()) return;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const idColumn = await sheets.spreadsheets.values.get({ spreadsheetId, range: ORDERS_ID_RANGE });
  const ids = (idColumn.data.values ?? []).map((row) => String(row[0] ?? '').trim());
  const index = ids.indexOf(orderId);
  if (index === -1) {
    console.warn(`[sheets] Order ${orderId} not found in Orders tab.`);
    return;
  }
  const rowNumber = index + 1;

  const data: sheets_v4.Schema$ValueRange[] = [];
  if (updates.razorpayOrderId !== undefined) {
    data.push({ range: `Orders!K${rowNumber}`, values: [[updates.razorpayOrderId]] });
  }
  if (updates.razorpayPaymentId !== undefined) {
    data.push({ range: `Orders!L${rowNumber}`, values: [[updates.razorpayPaymentId]] });
  }
  if (updates.status !== undefined) {
    data.push({ range: `Orders!M${rowNumber}`, values: [[updates.status]] });
  }
  data.push({
    range: `Orders!O${rowNumber}`,
    values: [[updates.updatedAt ?? new Date().toISOString()]],
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
}
