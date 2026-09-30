/**
 * Google Sheets access (server-only).
 *
 * The "Products" tab is the product catalogue; the "Orders" tab is a
 * human-readable copy of every order (Firestore is the source of truth).
 * Row 1 of each tab holds headers; data starts on row 2.
 */
import { google, type sheets_v4 } from 'googleapis';
import { unstable_cache } from 'next/cache';
import type { Order, OrderStatus, Product, ProductStatus } from './types';
import { normaliseImageUrl } from './utils';

const PRODUCTS_RANGE = 'Products!A2:S';
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
} as const;

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set.');
  return id;
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

async function fetchAllProductRows(): Promise<Product[]> {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: PRODUCTS_RANGE,
  });
  const rows = (response.data.values ?? []) as unknown[][];
  return rows.map(rowToProduct).filter((p): p is Product => p !== null);
}

/**
 * Cached for 60 seconds so we stay well within the Sheets API quota.
 * Errors are thrown (and therefore not cached) so the next request retries.
 */
const fetchAllProductsCached = unstable_cache(fetchAllProductRows, ['vl-sheet-products'], {
  revalidate: 60,
  tags: ['products'],
});

/** Every product row, including drafts and archived ones. */
async function getAllProducts(): Promise<Product[]> {
  if (!isSheetsConfigured()) {
    console.warn('[sheets] Google Sheets is not configured — returning no products.');
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
