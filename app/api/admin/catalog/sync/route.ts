/**
 * POST /api/admin/catalog/sync
 * Reads all supplier sheets (or one if supplierId is passed) and upserts into Firestore.
 *
 * Upsert rules:
 * - Family: create if familySku not seen before; skip if exists
 * - Listing: create if listingSku not seen before; if exists, update title/description/color/brand/category from sheet
 * - SKU: create if sku (childSku) not seen before with markup=supplier.margin, sellingPrice=supplierPrice+margin
 *        if exists: update supplierPrice and stockQuantity ONLY — NEVER touch markup, mrp, sellingPrice (admin-controlled)
 *
 * Returns: { ok: true, stats: { families, listings, skus, updated, warnings } }
 * Protected by middleware Basic Auth (no extra auth needed — route is under /api/admin/).
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  LISTINGS_COLLECTION,
  SKUS_COLLECTION,
  createFamily,
  createListing,
  createSku,
  getAllSkus,
  getFamilies,
  getListings,
} from '@/lib/catalog-admin';
import { parseCatalogFromSheet, skuKey, type ParsedCatalog } from '@/lib/catalog-sync';
import { getSuppliers } from '@/lib/suppliers';
import { mirrorListingImages } from '@/lib/storage';
import { errorResponse, isPlainObject } from '@/lib/catalog-validation';
import type { ProductFamily, ProductListing, ProductSku } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ParsedListing = NonNullable<ReturnType<ParsedCatalog['listings']['get']>>;

const CREATE_CHUNK = 20;
/** Firestore allows 500 writes per batch; stay well under it. */
const UPDATE_BATCH = 400;

/** Runs `fn` over `items` in parallel chunks of `size`. */
async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** Commits `{ collection, id, patch }` updates in WriteBatches. */
async function commitUpdates(updates: { collection: string; id: string; patch: Record<string, unknown> }[]): Promise<void> {
  const db = getAdminDb();
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + UPDATE_BATCH)) {
      batch.update(db.collection(u.collection).doc(u.id), u.patch);
    }
    await batch.commit();
  }
}

export async function POST(request: Request) {
  try {
    // Optional body: { supplierId?: string, familyLimit?: number }
    // familyLimit caps how many product families are imported per supplier sheet (useful for testing).
    let supplierId: string | undefined;
    let familyLimit: number | undefined;
    const text = await request.text();
    if (text.trim()) {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
      }
      if (isPlainObject(body)) {
        if (typeof body.supplierId === 'string' && body.supplierId.trim()) {
          supplierId = body.supplierId.trim();
        }
        if (typeof body.familyLimit === 'number' && body.familyLimit > 0) {
          familyLimit = Math.floor(body.familyLimit);
        }
      }
    }

    const allSuppliers = await getSuppliers();
    const suppliers = supplierId ? allSuppliers.filter((s) => s.id === supplierId) : allSuppliers;
    if (supplierId && suppliers.length === 0) {
      return NextResponse.json({ error: `Supplier ${supplierId} not found.` }, { status: 404 });
    }

    // Existing catalog, loaded once and kept current as we create records,
    // so a SKU that appears in two suppliers' sheets is only created once.
    const [families, listings, skus] = await Promise.all([getFamilies(), getListings(), getAllSkus()]);
    const familyBySku = new Map<string, ProductFamily>(families.map((f) => [skuKey(f.familySku), f]));
    const listingBySku = new Map<string, ProductListing>(listings.map((l) => [skuKey(l.listingSku), l]));
    const skuBySku = new Map<string, ProductSku>(skus.map((s) => [skuKey(s.sku), s]));

    const stats = {
      suppliers: 0,
      families: 0,
      listings: 0,
      skus: 0,
      updated: { listings: 0, skus: 0 },
      warnings: [] as string[],
    };

    for (const supplier of suppliers) {
      const label = supplier.name || supplier.id;
      if (!supplier.spreadsheetId) {
        stats.warnings.push(`${label}: no spreadsheet ID — skipped.`);
        continue;
      }

      let parsed: ParsedCatalog;
      try {
        parsed = await parseCatalogFromSheet(supplier.spreadsheetId, supplier.sheetTab);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stats.warnings.push(`${label}: could not read sheet "${supplier.sheetTab}" — ${message.slice(0, 300)}`);
        continue;
      }
      stats.suppliers++;
      stats.warnings.push(...parsed.warnings.map((w) => `${label}: ${w}`));

      // Apply familyLimit: keep only the first N families and their child listings/SKUs.
      if (familyLimit !== undefined) {
        const allowedFamilySkus = new Set(
          Array.from(parsed.families.keys()).slice(0, familyLimit)
        );
        for (const key of [...parsed.families.keys()]) {
          if (!allowedFamilySkus.has(key)) parsed.families.delete(key);
        }
        for (const [key, l] of [...parsed.listings.entries()]) {
          if (!allowedFamilySkus.has(skuKey(l.familySku))) parsed.listings.delete(key);
        }
        parsed.skus = parsed.skus.filter((row) => allowedFamilySkus.has(skuKey(row.familySku)));
        stats.warnings.push(`${label}: familyLimit=${familyLimit} — imported ${parsed.families.size} families.`);
      }

      // Families — create missing, never update.
      const newFamilies = Array.from(parsed.families.entries()).filter(([key]) => !familyBySku.has(key));
      const createdFamilies = await inChunks(newFamilies, CREATE_CHUNK, ([, f]) => createFamily({ familySku: f.familySku }));
      for (const f of createdFamilies) familyBySku.set(skuKey(f.familySku), f);
      stats.families += createdFamilies.length;

      // Listings — create missing; refresh text fields on existing ones (non-empty sheet values only).
      const listingUpdates: { collection: string; id: string; patch: Record<string, unknown> }[] = [];
      const newListings: ParsedListing[] = [];
      for (const [key, l] of parsed.listings) {
        const existing = listingBySku.get(key);
        if (!existing) {
          newListings.push(l);
          continue;
        }
        const patch: Record<string, unknown> = {};
        for (const field of ['title', 'description', 'color', 'colorCode', 'brand', 'category'] as const) {
          const value = l[field].trim();
          if (value && value !== existing[field]) patch[field] = value;
        }
        // Only add images from sheet if the listing has none yet (never overwrite admin-set images).
        // Mirrored to Firebase Storage when FIREBASE_STORAGE_BUCKET is set; otherwise unchanged.
        if (l.images.length > 0 && existing.images.length === 0) {
          const mirrored = await mirrorListingImages(l.images, l.listingSku);
          patch.images = mirrored;
          patch.coverImage = mirrored[0] ?? '';
        }
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date().toISOString();
          listingUpdates.push({ collection: LISTINGS_COLLECTION, id: existing.id, patch });
          listingBySku.set(key, { ...existing, ...patch });
        }
      }
      const createdListings = await inChunks(newListings, CREATE_CHUNK, async (l) => {
        const family = familyBySku.get(skuKey(l.familySku));
        if (!family) throw new Error(`Family ${l.familySku} missing for listing ${l.listingSku}.`);
        const images = await mirrorListingImages(l.images, l.listingSku);
        return createListing({
          familyId: family.id,
          listingSku: l.listingSku,
          title: l.title || l.listingSku,
          description: l.description,
          brand: l.brand,
          category: l.category,
          color: l.color,
          colorCode: l.colorCode,
          images,
          coverImage: images[0] ?? '',
          status: 'draft',
        });
      });
      for (const l of createdListings) listingBySku.set(skuKey(l.listingSku), l);
      stats.listings += createdListings.length;
      await commitUpdates(listingUpdates);
      stats.updated.listings += listingUpdates.length;

      // SKUs — create missing with supplier markup; existing ones only get supplierPrice + stockQuantity.
      const skuUpdates: { collection: string; id: string; patch: Record<string, unknown> }[] = [];
      const newSkus: typeof parsed.skus = [];
      for (const row of parsed.skus) {
        const existing = skuBySku.get(skuKey(row.childSku));
        if (!existing) {
          newSkus.push(row);
          continue;
        }
        const patch: Record<string, unknown> = {};
        if (row.supplierPrice > 0 && row.supplierPrice !== existing.supplierPrice) patch.supplierPrice = row.supplierPrice;
        if (parsed.hasStockColumn && row.stock !== existing.stockQuantity) patch.stockQuantity = row.stock;
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date().toISOString();
          skuUpdates.push({ collection: SKUS_COLLECTION, id: existing.id, patch });
          skuBySku.set(skuKey(row.childSku), { ...existing, ...patch });
        }
      }
      const margin = supplier.margin;
      const createdSkus = await inChunks(newSkus, CREATE_CHUNK, (row) => {
        const listing = listingBySku.get(skuKey(row.listingSku));
        if (!listing) throw new Error(`Listing ${row.listingSku} missing for SKU ${row.childSku}.`);
        return createSku({
          listingId: listing.id,
          sku: row.childSku,
          size: row.size,
          supplierPrice: row.supplierPrice,
          markup: margin,
          mrp: row.mrp,
          sellingPrice: row.supplierPrice + margin,
          stockQuantity: row.stock,
          barcode: row.barcode,
          status: 'active',
        });
      });
      for (const s of createdSkus) skuBySku.set(skuKey(s.sku), s);
      stats.skus += createdSkus.length;
      await commitUpdates(skuUpdates);
      stats.updated.skus += skuUpdates.length;
    }

    if (suppliers.length === 0) stats.warnings.push('No suppliers configured.');
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    return errorResponse(err, 'Catalog sync failed.');
  }
}
