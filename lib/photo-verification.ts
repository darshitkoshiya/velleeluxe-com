/**
 * Automatic photo check for damage / defect / wrong-item returns (server-only).
 *
 * Sends the customer's photos plus reference product images to Gemini Vision:
 *  - the product image of the item being returned (current order)
 *  - product images from the customer's OTHER orders in the last 90 days
 *
 * Outcome:
 *  - photo matches an item from an older order          -> rejected (returning an old shirt)
 *  - damaged/defective: matches the current item + shows damage -> approved
 *  - wrong item: shows a shirt that is not the one ordered       -> approved
 *  - anything uncertain, or Gemini unavailable          -> review (admin decides)
 *
 * Env: GEMINI_API_KEY (required for the check), GEMINI_MODEL (optional).
 */
import { getAdminDb } from './firebase-admin';
import { PHOTO_CHECK_LOOKBACK_DAYS } from './returns-shared';
import type { Order, OrderItem, ReturnPhotoVerification, ReturnReason } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30_000;
const REFERENCE_TIMEOUT_MS = 8_000;
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const MAX_OLDER_REFERENCES = 6;
/** Below this confidence the result is treated as uncertain. */
const MIN_CONFIDENCE = 0.7;

interface InlineImage {
  mimeType: string;
  data: string;
}

interface OlderReference {
  label: string;
  orderId: string;
  productName: string;
  image: InlineImage;
}

interface GeminiVerdict {
  showsShirt?: boolean;
  showsDamageOrDefect?: boolean;
  match?: 'current' | 'older' | 'none' | 'uncertain';
  matchedReference?: string | null;
  confidence?: number;
  reason?: string;
}

/** "data:image/jpeg;base64,AAAA" -> { mimeType, data } */
function parseDataUrl(dataUrl: string): InlineImage | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  return match ? { mimeType: match[1].toLowerCase(), data: match[2] } : null;
}

/** Downloads a product image (Google Drive etc.) and returns it as base64. Null on any failure. */
async function fetchImage(url: string): Promise<InlineImage | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return parseDataUrl(url);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(REFERENCE_TIMEOUT_MS) });
    const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!response.ok || !mimeType.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REFERENCE_BYTES) return null;
    return { mimeType, data: buffer.toString('base64') };
  } catch {
    return null;
  }
}

/** Items from the customer's other delivered/shipped orders in the lookback window. */
async function olderOrderItems(
  customerId: string,
  currentOrderId: string,
): Promise<{ items: { orderId: string; item: OrderItem }[]; orders: Order[] }> {
  const since = Date.now() - PHOTO_CHECK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const snapshot = await getAdminDb().collection('orders').where('customerId', '==', customerId).get();
  const orders = snapshot.docs
    .map((doc) => doc.data() as Order)
    .filter(
      (order) =>
        order.orderId !== currentOrderId &&
        (order.status === 'delivered' || order.status === 'shipped') &&
        Date.parse(order.createdAt) >= since,
    )
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const items = orders.flatMap((order) => order.items.map((item) => ({ orderId: order.orderId, item })));
  return { items, orders };
}

function buildPrompt(reason: ReturnReason, productName: string, photoCount: number, older: OlderReference[]): string {
  const claim =
    reason === 'wrong_item'
      ? `The customer says they RECEIVED THE WRONG ITEM instead of "${productName}".`
      : `The customer says their "${productName}" arrived DAMAGED or DEFECTIVE.`;
  const olderList = older.length
    ? older.map((ref) => `- ${ref.label}: "${ref.productName}" from an older order`).join('\n')
    : '- (none)';
  return [
    'You verify return requests for an online shirt store. Be strict and factual.',
    claim,
    `You will see ${photoCount} CUSTOMER PHOTO(S), then reference product images:`,
    `- REFERENCE CURRENT: "${productName}" (the item in the order being returned)`,
    olderList,
    '',
    'Answer these questions:',
    '1. showsShirt: do the customer photos show a shirt/garment?',
    '2. showsDamageOrDefect: do they show visible damage or a manufacturing defect (tear, hole, stain, broken button, faulty stitching, misprint, etc.)?',
    '3. match: which reference product do the customer photos show? Compare colour, fabric, pattern, collar, buttons and cut.',
    '   "current" = REFERENCE CURRENT; "older" = one of the OLDER references; "none" = a different garment from all references;',
    '   "uncertain" = cannot tell. If the photos match both CURRENT and an OLDER reference equally, answer "uncertain".',
    '4. matchedReference: the label of the matched OLDER reference (e.g. "REFERENCE OLDER 2"), else null.',
    '5. confidence: 0 to 1 for your match answer.',
    '6. reason: one short sentence explaining your answer, suitable for a store admin.',
    '',
    'Respond with JSON only: {"showsShirt": boolean, "showsDamageOrDefect": boolean, "match": "current"|"older"|"none"|"uncertain", "matchedReference": string|null, "confidence": number, "reason": string}',
  ].join('\n');
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  photos: InlineImage[],
  current: InlineImage,
  older: OlderReference[],
): Promise<GeminiVerdict> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  photos.forEach((photo, index) => {
    parts.push({ text: `CUSTOMER PHOTO ${index + 1}:` });
    parts.push({ inline_data: { mime_type: photo.mimeType, data: photo.data } });
  });
  parts.push({ text: 'REFERENCE CURRENT:' });
  parts.push({ inline_data: { mime_type: current.mimeType, data: current.data } });
  older.forEach((ref) => {
    parts.push({ text: `${ref.label}:` });
    parts.push({ inline_data: { mime_type: ref.image.mimeType, data: ref.image.data } });
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
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
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json) as GeminiVerdict;
}

function review(reason: string, extra: Partial<ReturnPhotoVerification> = {}): ReturnPhotoVerification {
  return { verdict: 'review', reason, checkedAt: new Date().toISOString(), ...extra };
}

/**
 * Runs the photo check. Never throws: any failure becomes a "review" verdict
 * so the request still reaches the admin.
 */
export async function verifyReturnPhotos(input: {
  reason: ReturnReason;
  customerId: string;
  orderId: string;
  item: OrderItem;
  photoDataUrls: string[];
}): Promise<ReturnPhotoVerification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return review('Automatic photo check is not configured (GEMINI_API_KEY missing). Please review manually.');
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    const photos = input.photoDataUrls.map(parseDataUrl).filter((photo): photo is InlineImage => photo !== null);
    if (photos.length === 0) return review('No readable photos were uploaded.', { model });

    const current = input.item.image ? await fetchImage(input.item.image) : null;
    if (!current) return review('Could not load the product image for comparison. Please review manually.', { model });

    // Older orders: one reference per distinct product. The same product bought earlier
    // looks identical, so it cannot be told apart — those requests always go to manual review.
    const { items } = await olderOrderItems(input.customerId, input.orderId);
    const sameProductBefore = items.find(({ item }) => item.productId === input.item.productId);
    const seen = new Set<string>([input.item.productId]);
    const candidates = items.filter(({ item }) => {
      if (!item.image || seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    });
    const older: OlderReference[] = [];
    for (const { orderId, item } of candidates) {
      if (older.length >= MAX_OLDER_REFERENCES) break;
      const image = await fetchImage(item.image ?? '');
      if (image) older.push({ label: `REFERENCE OLDER ${older.length + 1}`, orderId, productName: item.productName, image });
    }

    const prompt = buildPrompt(input.reason, input.item.productName, photos.length, older);
    const verdict = await callGemini(apiKey, model, prompt, photos, current, older);

    const confidence = typeof verdict.confidence === 'number' ? Math.max(0, Math.min(1, verdict.confidence)) : 0;
    const match = verdict.match && ['current', 'older', 'none', 'uncertain'].includes(verdict.match) ? verdict.match : 'uncertain';
    const matchedOlder = match === 'older' ? older.find((ref) => ref.label === verdict.matchedReference) : undefined;
    const base = {
      showsShirt: Boolean(verdict.showsShirt),
      showsDamageOrDefect: Boolean(verdict.showsDamageOrDefect),
      match,
      matchedOrderId: matchedOlder?.orderId,
      confidence,
      model,
      checkedAt: new Date().toISOString(),
    } as const;
    const aiReason = (verdict.reason || '').slice(0, 300);
    const confident = confidence >= MIN_CONFIDENCE;

    if (match === 'older' && confident) {
      return {
        ...base,
        verdict: 'rejected',
        reason: `The photo matches an item from an earlier order${matchedOlder ? ` (${matchedOlder.orderId})` : ''}, not this order. ${aiReason}`.trim(),
      };
    }

    if (input.reason === 'damaged_defective') {
      if (match === 'current' && confident && base.showsDamageOrDefect) {
        if (sameProductBefore) {
          return { ...base, verdict: 'review', reason: `Photo matches this item and shows damage, but the customer bought the same product in order ${sameProductBefore.orderId} recently. ${aiReason}`.trim() };
        }
        return { ...base, verdict: 'approved', reason: aiReason || 'Photo shows this item with visible damage.' };
      }
      return { ...base, verdict: 'review', reason: aiReason || 'The automatic check could not confirm the damage.' };
    }

    // Wrong item: the photo should show a garment that is NOT the one ordered.
    if (match === 'none' && confident && base.showsShirt) {
      return { ...base, verdict: 'approved', reason: aiReason || 'Photo shows a different garment from the one ordered.' };
    }
    return { ...base, verdict: 'review', reason: aiReason || 'The automatic check could not confirm a wrong item.' };
  } catch (error) {
    console.error('[photo-verification] Check failed:', error);
    return review('The automatic photo check failed. Please review manually.', { model });
  }
}
