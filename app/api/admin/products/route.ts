/**
 * GET  /api/admin/products — returns { products: AdminProduct[] } (sheet + manual, hidden included,
 *                            overrides applied, with override fields on each row)
 * POST /api/admin/products — body one of:
 *   { type: 'override', productId, priceOverride?, titleOverride?, descriptionOverride?, featured?, hidden? }
 *       Upserts productOverrides/{productId}. Pass null (or '' for text) to clear a field.
 *   { type: 'manual', slug?, name, description, price, images, sizes, colour, fabric?, stock, featured?, hidden? }
 *       Creates manualProducts/{slug} (slug generated from name if omitted). When the slug already
 *       exists, the fields sent are merged into it (partial update, e.g. just { featured }).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getProducts } from '@/lib/sheets';
import {
  buildAdminProducts,
  getManualProduct,
  getManualProducts,
  getProductOverrides,
  MANUAL_ID_PREFIX,
  revalidateProductData,
  setManualProduct,
  setProductOverride,
  slugify,
  type OverrideUpdate,
} from '@/lib/product-overrides';
import type { ManualProduct } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ALLOWED_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const MAX_PRICE = 1_000_000;
const MAX_TEXT = 5000;

export async function GET() {
  try {
    const [sheetProducts, overrides, manual] = await Promise.all([
      getProducts(),
      getProductOverrides(),
      getManualProducts(),
    ]);
    return NextResponse.json({ products: buildAdminProducts(sheetProducts, overrides, manual) });
  } catch (error) {
    console.error('[api/admin/products] Failed to load products:', error);
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 });
  }
}

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_PRICE;
}

/** Text override: null/'' clears, string sets. */
function parseTextOverride(value: unknown, label: string): { value: string | null } | { error: string } {
  if (value === null) return { value: null };
  if (typeof value !== 'string') return { error: `${label} must be text.` };
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT) return { error: `${label} is too long.` };
  return { value: trimmed === '' ? null : trimmed };
}

function parseOverride(body: Record<string, unknown>): { productId: string; update: OverrideUpdate } | { error: string } {
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId || productId.includes('/')) return { error: 'productId is required.' };
  if (productId.startsWith(MANUAL_ID_PREFIX)) return { error: 'Manual products are edited with type "manual".' };

  const update: OverrideUpdate = {};
  if ('priceOverride' in body) {
    const price = body.priceOverride;
    if (price === null || price === '') update.priceOverride = null;
    else if (isValidPrice(price)) update.priceOverride = price;
    else return { error: 'Price override must be a positive number.' };
  }
  if ('titleOverride' in body) {
    const parsed = parseTextOverride(body.titleOverride, 'Title');
    if ('error' in parsed) return parsed;
    update.titleOverride = parsed.value;
  }
  if ('descriptionOverride' in body) {
    const parsed = parseTextOverride(body.descriptionOverride, 'Description');
    if ('error' in parsed) return parsed;
    update.descriptionOverride = parsed.value;
  }
  for (const key of ['featured', 'hidden'] as const) {
    if (!(key in body)) continue;
    const flag = body[key];
    if (flag !== null && typeof flag !== 'boolean') return { error: `${key} must be true or false.` };
    update[key] = flag as boolean | null;
  }
  return { productId, update };
}

type ManualFields = Partial<Omit<ManualProduct, 'id' | 'slug' | 'isManual' | 'createdAt' | 'updatedAt'>>;

function parseManualFields(body: Record<string, unknown>): { fields: ManualFields } | { error: string } {
  const fields: ManualFields = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) return { error: 'Name is required.' };
    if (body.name.trim().length > 200) return { error: 'Name is too long.' };
    fields.name = body.name.trim();
  }
  if ('description' in body) {
    if (typeof body.description !== 'string') return { error: 'Description must be text.' };
    if (body.description.length > MAX_TEXT) return { error: 'Description is too long.' };
    fields.description = body.description.trim();
  }
  if ('price' in body) {
    if (!isValidPrice(body.price)) return { error: 'Price must be a positive number.' };
    fields.price = body.price;
  }
  if ('images' in body) {
    if (!Array.isArray(body.images) || !body.images.every((url) => typeof url === 'string')) {
      return { error: 'Images must be a list of URLs.' };
    }
    const images = (body.images as string[]).map((url) => url.trim()).filter(Boolean);
    if (!images.every((url) => /^https?:\/\/\S+$/i.test(url))) {
      return { error: 'Every image URL must start with http:// or https://' };
    }
    fields.images = images;
  }
  if ('sizes' in body) {
    if (!Array.isArray(body.sizes) || !body.sizes.every((size) => ALLOWED_SIZES.includes(size as string))) {
      return { error: `Sizes must be from: ${ALLOWED_SIZES.join(', ')}.` };
    }
    fields.sizes = ALLOWED_SIZES.filter((size) => (body.sizes as string[]).includes(size));
  }
  if ('colour' in body) {
    if (typeof body.colour !== 'string') return { error: 'Colour must be text.' };
    fields.colour = body.colour.trim();
  }
  if ('fabric' in body) {
    if (body.fabric !== undefined && body.fabric !== null && typeof body.fabric !== 'string') {
      return { error: 'Fabric must be text.' };
    }
    fields.fabric = typeof body.fabric === 'string' ? body.fabric.trim() : '';
  }
  if ('stock' in body) {
    const stock = body.stock;
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      return { error: 'Stock must be a whole number (0 or more).' };
    }
    fields.stock = stock;
  }
  for (const key of ['featured', 'hidden'] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'boolean') return { error: `${key} must be true or false.` };
    fields[key] = body[key] as boolean;
  }
  return { fields };
}

async function saveManual(body: Record<string, unknown>) {
  const parsed = parseManualFields(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;

  const requestedSlug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : '';
  const slug = slugify(requestedSlug || fields.name || '');
  if (!slug) return NextResponse.json({ error: 'Could not build a URL slug from the name.' }, { status: 400 });

  const existing = await getManualProduct(slug);
  const now = new Date().toISOString();

  if (existing && body.createOnly === true) {
    return NextResponse.json(
      { error: `A product with the URL "${slug}" already exists. Choose a different name.` },
      { status: 409 },
    );
  }

  if (existing) {
    // Partial update of an existing manual product.
    const product: ManualProduct = { ...existing, ...fields, slug, isManual: true, updatedAt: now };
    await setManualProduct(product);
    return NextResponse.json({ product });
  }

  // New product: required fields must be present.
  if (!fields.name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (fields.price === undefined) return NextResponse.json({ error: 'Price is required.' }, { status: 400 });

  const sheetProducts = await getProducts();
  if (sheetProducts.some((product) => product.slug === slug)) {
    return NextResponse.json(
      { error: `A supplier product already uses the URL "${slug}". Choose a different name.` },
      { status: 409 },
    );
  }

  const product: ManualProduct = {
    id: `${MANUAL_ID_PREFIX}${slug}`,
    slug,
    name: fields.name,
    description: fields.description ?? '',
    price: fields.price,
    images: fields.images ?? [],
    sizes: fields.sizes ?? [],
    colour: fields.colour ?? '',
    fabric: fields.fabric || undefined,
    stock: fields.stock ?? 0,
    featured: fields.featured ?? false,
    hidden: fields.hidden ?? false,
    isManual: true,
    createdAt: now,
    updatedAt: now,
  };
  await setManualProduct(product);
  return NextResponse.json({ product });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  try {
    if (input.type === 'override') {
      const parsed = parseOverride(input);
      if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await setProductOverride(parsed.productId, parsed.update);
      revalidateProductData();
      return NextResponse.json({ ok: true });
    }
    if (input.type === 'manual') {
      const response = await saveManual(input);
      if (response.ok) revalidateProductData();
      return response;
    }
    return NextResponse.json({ error: 'type must be "override" or "manual".' }, { status: 400 });
  } catch (error) {
    console.error('[api/admin/products] Failed to save:', error);
    return NextResponse.json({ error: 'Could not save product.' }, { status: 500 });
  }
}
