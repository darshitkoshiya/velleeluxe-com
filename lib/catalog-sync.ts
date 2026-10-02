/**
 * Catalog sync — reads one supplier Google Sheet and maps its rows onto the
 * 3-level catalog (family → listing → SKU). Server-only. No Firestore writes
 * happen here; see app/api/admin/catalog/sync/route.ts for the upsert.
 *
 * Columns are found by keyword matching on the header row(s), the same free,
 * no-AI approach as lib/sheets.ts (detectSchemaFromHeaders).
 */
import { google, type sheets_v4 } from 'googleapis';

/* ------------------------------------------------------------------ */
/* Google Sheets client (same auth as lib/sheets.ts)                   */
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
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

/** Quotes a tab name for use in an A1 range, e.g. My Tab → 'My Tab'!A1:B2. */
function tabRange(tab: string, range: string): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CatalogSyncRow {
  familySku: string;
  listingSku: string;
  childSku: string;
  size: string;
  title: string;
  description: string;
  color: string;
  colorCode: string;
  brand: string;
  category: string;
  images: string[];
  supplierPrice: number;
  mrp: number;
  stock: number;
  barcode: string;
}

export interface ParsedCatalog {
  families: Map<string, { familySku: string }>;
  listings: Map<string, {
    familySku: string;
    listingSku: string;
    title: string;
    description: string;
    color: string;
    colorCode: string;
    brand: string;
    category: string;
    images: string[];
  }>;
  skus: CatalogSyncRow[];
  warnings: string[];
  /** False when the sheet has no stock column — sync must not overwrite stock with 0. */
  hasStockColumn: boolean;
}

type Field =
  | 'familySku' | 'listingSku' | 'childSku' | 'size' | 'title' | 'description'
  | 'color' | 'colorCode' | 'images' | 'supplierPrice' | 'mrp' | 'stock' | 'brand' | 'category' | 'barcode';

type ColumnMap = Record<Field, number | null>;

/* ------------------------------------------------------------------ */
/* Column detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Detection order matters: more specific columns claim their header first so
 * generic keywords can't steal them ("color code" before "color", "mrp" /
 * "max price" before "price", "brand name" before "name", "family sku" /
 * "parent sku" before "sku"). A header index is only ever assigned once.
 */
const FIELD_KEYWORDS: [Field, string[]][] = [
  ['familySku', ['family sku', 'family_sku', 'style code', 'style_code', 'color grouping', 'colour grouping', 'color-grouping', 'design code', 'family', 'design']],
  ['listingSku', ['parent sku', 'parent_sku', 'sku base', 'base sku', 'listing sku', 'listing_sku']],
  ['colorCode', ['color code', 'colour code', 'color_code', 'colour_code', 'hex']],
  ['images', ['image url', 'image urls', 'images', 'image', 'photo url', 'photo urls', 'photos', 'picture url', 'picture urls', 'pictures']],
  ['mrp', ['mrp', 'm.r.p', 'maximum retail price', 'compare at', 'market price', 'max price']],
  ['barcode', ['barcode', 'ean', 'upc', 'isbn']],
  ['brand', ['brand name', 'brand']],
  ['color', ['color name', 'colour name', 'color', 'colour']],
  ['category', ['product type', 'category', 'type']],
  ['childSku', ['child sku', 'child_sku', 'product code', 'item code', 'sku']],
  ['size', ['uk size', 'size', 'variant']],
  ['description', ['product description', 'description', 'details', 'desc']],
  ['title', ['product name', 'item name', 'title', 'name']],
  ['supplierPrice', ['supplier price', 'selling price', 'cost price', 'purchase price', 'sp', 'price']],
  ['stock', ['stock', 'qty', 'quantity', 'inventory', 'available']],
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalises a header: lowercase, collapse whitespace/newlines. */
function normHeader(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Header cells that are never a data field (serial-number columns). */
const SKIP_HEADER = /^(sr\.?\s*(no\.?|#?)|s\.\s*no\.?|#|sl\.?\s*no\.?|serial|row|index|no\.?)$/i;

function detectColumns(headers: string[]): ColumnMap {
  const map = Object.fromEntries(FIELD_KEYWORDS.map(([f]) => [f, null])) as ColumnMap;
  const used = new Set<number>();
  const candidates = headers.map((h, i) => ({ h: normHeader(h), i })).filter((c) => c.h && !SKIP_HEADER.test(c.h));

  for (const [field, keywords] of FIELD_KEYWORDS) {
    // Pass 1: exact header match (by keyword priority). Pass 2: keyword as a whole word inside the header.
    let found: number | null = null;
    for (const kw of keywords) {
      const hit = candidates.find((c) => !used.has(c.i) && c.h === kw);
      if (hit) { found = hit.i; break; }
    }
    if (found === null) {
      for (const kw of keywords) {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(kw)}($|[^a-z0-9])`, 'i');
        const hit = candidates.find((c) => !used.has(c.i) && re.test(c.h));
        if (hit) { found = hit.i; break; }
      }
    }
    if (found !== null) {
      map[field] = found;
      used.add(found);
    }
  }
  return map;
}

function countDetected(map: ColumnMap): number {
  return Object.values(map).filter((v) => v !== null).length;
}

function cellText(row: unknown[] | undefined, index: number | null): string {
  if (!row || index === null) return '';
  const value = row[index];
  return value === undefined || value === null ? '' : String(value).trim();
}

/** A row "looks like data" when 2+ of its cells are plain numbers (prices, qty). Header rows rarely are. */
function looksLikeDataRow(row: unknown[] | undefined): boolean {
  if (!row) return false;
  let numeric = 0;
  for (const value of row) {
    const text = String(value ?? '').replace(/[₹,\s]/g, '');
    if (text && Number.isFinite(Number(text))) numeric++;
  }
  return numeric >= 2;
}

/* ------------------------------------------------------------------ */
/* Value parsing                                                       */
/* ------------------------------------------------------------------ */

/** Splits a cell containing one or more image URLs (comma, newline, or space-separated). */
function parseImageUrls(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'));
}

/** "₹1,499", "Rs. 1499", "1499.00" → 1499. Returns 0 when not a non-negative number. */
function parseMoney(raw: string): number {
  if (!raw) return 0;
  const value = Number(raw.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

/** "1,200" → 1200. Missing / invalid → 0. */
function parseQty(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Trailing size segment, e.g. "HK0002-SH-S" → "-S". */
const SIZE_SUFFIX = /[-\/](?:XS|S|M|L|XL|XXL|2XL|3XL|\d+(?:XL)?)$/i;

/**
 * "HK0002-SH-S" → "HK0002-SH". When the row's size is known, strips exactly
 * "-{size}" first (safest); otherwise falls back to the generic size regex.
 */
function stripSizeSuffix(childSku: string, size: string): string {
  if (size) {
    const exact = new RegExp(`[-\\/]${escapeRegex(size)}$`, 'i');
    if (exact.test(childSku)) return childSku.replace(exact, '');
  }
  return childSku.replace(SIZE_SUFFIX, '');
}

/** Size taken from the SKU's trailing segment when there is no size column. */
function sizeFromSku(childSku: string): string {
  const match = childSku.match(SIZE_SUFFIX);
  return match ? match[0].slice(1).toUpperCase() : '';
}

function slugSku(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Case-insensitive grouping key for SKU-like values. */
export function skuKey(value: string): string {
  return value.trim().toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const FIELD_LABEL: Record<Field, string> = {
  familySku: 'family SKU', listingSku: 'listing / parent SKU', childSku: 'child SKU', size: 'size',
  title: 'title / name', description: 'description', color: 'color', colorCode: 'color code',
  images: 'image URLs', supplierPrice: 'supplier price', mrp: 'MRP', stock: 'stock',
  brand: 'brand', category: 'category', barcode: 'barcode',
};

/**
 * Reads one supplier sheet tab and groups its rows into families, listings and SKUs.
 * Throws when Google is not configured or the sheet cannot be read.
 */
export async function parseCatalogFromSheet(
  spreadsheetId: string,
  sheetTab: string,
): Promise<ParsedCatalog> {
  if (!isGoogleConfigured()) {
    throw new Error('Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).');
  }
  const sheets = getSheetsClient();
  const warnings: string[] = [];
  const result: ParsedCatalog = { families: new Map(), listings: new Map(), skus: [], warnings, hasStockColumn: false };

  // 1. Header rows.
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(sheetTab, 'A1:AZ3'),
  });
  const top = (headerResponse.data.values ?? []) as unknown[][];
  const row1 = (top[0] ?? []).map((v) => String(v ?? '').trim());
  const row2 = (top[1] ?? []).map((v) => String(v ?? '').trim());
  if (row1.filter(Boolean).length === 0 && row2.filter(Boolean).length === 0) {
    warnings.push(`Tab "${sheetTab}" has no header row — nothing imported.`);
    return result;
  }

  // Decide whether the header is 1 row or 2 rows (two-row headers are merged like lib/sheets.ts).
  let headerRows = 1;
  let columns = detectColumns(row1);
  if (row2.some(Boolean) && !looksLikeDataRow(top[1])) {
    const width = Math.max(row1.length, row2.length);
    const merged = Array.from({ length: width }, (_, i) => `${row1[i] ?? ''} ${row2[i] ?? ''}`.trim());
    const mergedColumns = detectColumns(merged);
    const row2Columns = detectColumns(row2);
    const best = [
      { rows: 1, map: columns },
      { rows: 2, map: mergedColumns },
      { rows: 2, map: row2Columns },
    ].sort((a, b) => countDetected(b.map) - countDetected(a.map))[0];
    headerRows = best.rows;
    columns = best.map;
  }

  result.hasStockColumn = columns.stock !== null;

  // 2. Report what was / wasn't found.
  const missing = (Object.keys(FIELD_LABEL) as Field[]).filter((f) => columns[f] === null);
  if (missing.length > 0) {
    warnings.push(`Columns not found in "${sheetTab}": ${missing.map((f) => FIELD_LABEL[f]).join(', ')}.`);
  }
  if (columns.childSku === null && columns.title === null) {
    warnings.push(`Tab "${sheetTab}" has neither a SKU nor a name column — nothing imported.`);
    return result;
  }
  if (columns.childSku === null) warnings.push('No child SKU column — SKUs are built from title + size.');
  if (columns.listingSku === null) warnings.push('No listing / parent SKU column — derived by stripping the size from each child SKU.');
  if (columns.familySku === null) warnings.push('No family SKU column — each listing is its own family.');
  if (columns.supplierPrice === null) warnings.push('No supplier price column — new SKUs get supplier price 0.');

  // 3. Data rows.
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(sheetTab, `A${headerRows + 1}:AZ`),
  });
  const rows = (dataResponse.data.values ?? []) as unknown[][];

  let emptyRows = 0;
  let syntheticSkus = 0;
  let derivedListings = 0;
  const seenSkus = new Set<string>();
  const duplicateSkus: string[] = [];
  const familyConflicts: string[] = [];

  rows.forEach((row) => {
    const get = (field: Field) => cellText(row, columns[field]);
    let childSku = get('childSku');
    const title = get('title');
    if (!childSku && !title) {
      if (row.some((v) => String(v ?? '').trim())) emptyRows++;
      return;
    }

    let size = get('size').toUpperCase();
    if (!childSku) {
      // Synthetic SKU from title + size.
      childSku = [slugSku(title), slugSku(size)].filter(Boolean).join('-');
      syntheticSkus++;
    } else if (!size) {
      size = sizeFromSku(childSku);
    }

    let listingSku = get('listingSku');
    if (!listingSku) {
      listingSku = columns.childSku === null ? slugSku(title) : stripSizeSuffix(childSku, size);
      if (columns.listingSku !== null) derivedListings++;
    }
    // Blank family cell (merged-cell style) → inherit the listing's family if already seen, else the listing SKU.
    const explicitFamily = get('familySku');
    const familySku = explicitFamily || result.listings.get(skuKey(listingSku))?.familySku || listingSku;

    const key = skuKey(childSku);
    if (seenSkus.has(key)) {
      duplicateSkus.push(childSku);
      return;
    }
    seenSkus.add(key);

    const rowImages = parseImageUrls(get('images'));
    const sku: CatalogSyncRow = {
      familySku,
      listingSku,
      childSku,
      size,
      title,
      description: get('description'),
      color: get('color'),
      colorCode: get('colorCode'),
      images: rowImages,
      brand: get('brand'),
      category: get('category'),
      supplierPrice: parseMoney(get('supplierPrice')),
      mrp: parseMoney(get('mrp')),
      stock: parseQty(get('stock')),
      barcode: get('barcode'),
    };

    const familyKey = skuKey(familySku);
    const listingKey = skuKey(listingSku);
    const listing = result.listings.get(listingKey);
    if (!listing) {
      if (!result.families.has(familyKey)) result.families.set(familyKey, { familySku });
      result.listings.set(listingKey, {
        familySku,
        listingSku,
        title: sku.title,
        description: sku.description,
        color: sku.color,
        colorCode: sku.colorCode,
        images: rowImages,
        brand: sku.brand,
        category: sku.category,
      });
    } else {
      // Size rows often leave listing-level cells blank: fill from the first row that has them.
      if (skuKey(listing.familySku) !== familyKey) familyConflicts.push(listingSku);
      if (!listing.title) listing.title = sku.title;
      if (!listing.description) listing.description = sku.description;
      if (!listing.color) listing.color = sku.color;
      if (!listing.colorCode) listing.colorCode = sku.colorCode;
      if (!listing.images.length && rowImages.length) listing.images = rowImages;
      if (!listing.brand) listing.brand = sku.brand;
      if (!listing.category) listing.category = sku.category;
    }
    // A listing always belongs to the family of its first row.
    sku.familySku = result.listings.get(listingKey)!.familySku;
    result.skus.push(sku);
  });

  if (emptyRows > 0) warnings.push(`${emptyRows} row(s) skipped: no SKU and no name.`);
  if (syntheticSkus > 0) warnings.push(`${syntheticSkus} SKU(s) built from title + size (no child SKU in the row).`);
  if (derivedListings > 0) warnings.push(`${derivedListings} row(s) had a blank listing SKU — derived from the child SKU.`);
  if (duplicateSkus.length > 0) {
    warnings.push(`${duplicateSkus.length} duplicate child SKU row(s) ignored (first row kept): ${duplicateSkus.slice(0, 10).join(', ')}${duplicateSkus.length > 10 ? '…' : ''}`);
  }
  if (familyConflicts.length > 0) {
    const unique = Array.from(new Set(familyConflicts));
    warnings.push(`${unique.length} listing(s) appear under more than one family SKU — kept the first: ${unique.slice(0, 10).join(', ')}`);
  }
  const untitled = Array.from(result.listings.values()).filter((l) => !l.title).length;
  if (untitled > 0) warnings.push(`${untitled} listing(s) have no title in the sheet.`);

  return result;
}
