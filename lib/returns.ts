/**
 * Server-side logic for returns, exchanges, store credit and Razorpay refunds (Firebase Admin SDK).
 *
 * - `returns/{returnId}`               one document per request
 * - `users/{uid}/storeCredit/summary`  ledger, written through lib/store-credit.ts
 *
 * Rules:
 * - Size doesn't fit  -> size_exchange (in-stock size) or store_credit (size unavailable). Automatic.
 * - Wrong / damaged   -> damage_defect. Photos are checked by Gemini Vision: approved, rejected or
 *                        sent for admin review. Admin resolves with exchange or store credit, or
 *                        (prepaid orders only, rarely) a refund through the Razorpay API.
 * - COD orders never get cash back.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './firebase-admin';
import { getOrder } from './orders';
import { verifyReturnPhotos } from './photo-verification';
import { getRazorpay } from './razorpay';
import { getProductsByIds } from './sheets';
import { assertAdminTpin, storeCreditRef, writeStoreCreditEntry } from './store-credit';
import {
  decisionsFor,
  effectiveDecision,
  isWithinReturnWindow,
  MAX_DAMAGE_PHOTOS,
  MAX_DAMAGE_PHOTOS_TOTAL_CHARS,
  RETURN_DECISIONS,
  RETURN_REASONS,
  RETURN_STATUSES,
  RETURN_TYPES,
  typeForReason,
} from './returns-shared';
import type {
  CreateReturnRequest,
  ReturnDecision,
  ReturnReason,
  ReturnRequest,
  ReturnStatus,
  ReturnType,
  StoreCredit,
} from './types';

const RETURNS_COLLECTION = 'returns';

/** A refund lock older than this is treated as stale (e.g. the server crashed mid-call). */
const REFUND_LOCK_MS = 2 * 60 * 1000;

/** Thrown for problems the customer/admin can fix (shown to them as-is). */
export class ReturnValidationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function roundRupees(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function generateReturnId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `RT-${timestamp}-${random}`;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** Verifies "Authorization: Bearer <Firebase ID token>". Returns the user, or null. */
export async function verifyCustomer(
  authHeader: string | null,
): Promise<{ uid: string; email?: string; name?: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    return { uid: decoded.uid, email: decoded.email, name: typeof decoded.name === 'string' ? decoded.name : undefined };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Customer: create                                                    */
/* ------------------------------------------------------------------ */

const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/;

export function validateCreateReturn(body: unknown): ValidationResult<CreateReturnRequest> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request.' };

  const orderId = str(body.orderId, 64);
  const itemIndex = Number(body.itemIndex);
  const reason = body.reason as ReturnReason;
  const type = body.type as ReturnType;

  if (!orderId) return { ok: false, error: 'Order ID is missing.' };
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return { ok: false, error: 'Please choose an item.' };
  if (!RETURN_REASONS.includes(reason)) return { ok: false, error: 'Please tell us why you are returning this item.' };
  if (!RETURN_TYPES.includes(type)) return { ok: false, error: 'Please choose what you would like to do.' };

  // The reason decides the flow: size issues -> exchange / store credit; everything else -> damage_defect.
  const sizeFlow = reason === 'size_doesnt_fit';
  if (sizeFlow ? type === 'damage_defect' : type !== typeForReason(reason)) {
    return { ok: false, error: 'This request does not match the reason you chose.' };
  }

  const request: CreateReturnRequest = {
    orderId,
    itemIndex,
    reason,
    type,
    description: str(body.description, 1000) || undefined,
  };

  if (type === 'size_exchange') {
    const requestedSize = str(body.requestedSize, 10).toUpperCase();
    if (!requestedSize) return { ok: false, error: 'Please choose the size you would like.' };
    request.requestedSize = requestedSize;
  }

  if (type === 'damage_defect' || (type === 'store_credit' && Array.isArray(body.damagePhotoUrls) && body.damagePhotoUrls.length > 0)) {
    const raw = Array.isArray(body.damagePhotoUrls) ? body.damagePhotoUrls : [];
    const photos = raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (type === 'damage_defect' && photos.length === 0) return { ok: false, error: 'Please add at least one photo of the item.' };
    if (photos.length > MAX_DAMAGE_PHOTOS) return { ok: false, error: `You can add up to ${MAX_DAMAGE_PHOTOS} photos.` };
    if (!photos.every((photo) => DATA_URL_PATTERN.test(photo))) {
      return { ok: false, error: 'One of the photos could not be read. Please try another.' };
    }
    const totalChars = photos.reduce((sum, photo) => sum + photo.length, 0);
    if (totalChars > MAX_DAMAGE_PHOTOS_TOTAL_CHARS) {
      return { ok: false, error: 'Your photos are too large. Please add fewer photos.' };
    }
    if (photos.length > 0) request.damagePhotoUrls = photos;
  }

  return { ok: true, data: request };
}

/**
 * Creates a request after checking the order, the item, the 7-day window and duplicates.
 * For size flows, the requested size must be another size of a product that is still in stock.
 * Damage/defect requests are photo-checked; the verdict sets the starting status.
 */
export async function createReturn(
  request: CreateReturnRequest,
  customer: { uid: string; email?: string; name?: string },
): Promise<ReturnRequest> {
  const order = await getOrder(request.orderId);
  if (!order || order.customerId !== customer.uid) {
    throw new ReturnValidationError('We could not find this order on your account.', 404);
  }
  if (order.status !== 'delivered') {
    throw new ReturnValidationError('Returns and exchanges open once your order has been delivered.');
  }
  if (!isWithinReturnWindow(order)) {
    throw new ReturnValidationError('The 7-day return window for this order has closed. Please message us on WhatsApp if you need help.');
  }

  const item = order.items[request.itemIndex];
  if (!item) throw new ReturnValidationError('This item was not found in your order.', 404);

  if (request.type === 'size_exchange') {
    if (request.requestedSize === item.size.toUpperCase()) {
      throw new ReturnValidationError('Please choose a different size from the one you received.');
    }
    const [product] = await getProductsByIds([item.productId]).catch(() => []);
    const inStock = product && (product.stock === 'unlimited' || product.stock > 0);
    if (!product || !inStock || !product.sizes.map((size) => size.toUpperCase()).includes(request.requestedSize ?? '')) {
      throw new ReturnValidationError('That size is not available right now. Choose "My size is not available" to get store credit instead.', 409);
    }
  }

  const db = getAdminDb();
  const existing = await db.collection(RETURNS_COLLECTION).where('orderId', '==', order.orderId).get();
  const alreadyRequested = existing.docs.some((doc) => {
    const data = doc.data() as ReturnRequest;
    return data.customerId === customer.uid && data.itemIndex === request.itemIndex;
  });
  if (alreadyRequested) {
    throw new ReturnValidationError('A request already exists for this item. You can follow it under My Returns.', 409);
  }

  let status: ReturnStatus = 'requested';
  let verification: ReturnRequest['verification'];
  if (request.type === 'damage_defect') {
    verification = await verifyReturnPhotos({
      reason: request.reason,
      customerId: customer.uid,
      orderId: order.orderId,
      item,
      photoDataUrls: request.damagePhotoUrls ?? [],
    });
    status = verification.verdict === 'approved' ? 'requested' : verification.verdict === 'rejected' ? 'rejected' : 'pending_review';
  }

  const now = new Date().toISOString();
  const returnRequest: ReturnRequest = {
    returnId: generateReturnId(),
    orderId: order.orderId,
    customerId: customer.uid,
    customerName: order.customerName || customer.name || '',
    customerEmail: order.customerEmail || customer.email || '',
    itemIndex: request.itemIndex,
    itemProductId: item.productId,
    itemProductName: item.productName,
    itemSize: item.size,
    itemImage: item.image ?? '',
    itemPrice: item.price,
    type: request.type,
    reason: request.reason,
    requestedSize: request.type === 'size_exchange' ? request.requestedSize : undefined,
    damagePhotos: request.type === 'damage_defect' ? request.damagePhotoUrls : undefined,
    description: request.description,
    verification,
    paymentMethod: order.paymentMethod,
    status,
    resolvedAt: status === 'rejected' ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(RETURNS_COLLECTION).doc(returnRequest.returnId).set(returnRequest);
  return returnRequest;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getReturn(returnId: string): Promise<ReturnRequest | null> {
  const snapshot = await getAdminDb().collection(RETURNS_COLLECTION).doc(returnId).get();
  return snapshot.exists ? (snapshot.data() as ReturnRequest) : null;
}

function newestFirst(a: ReturnRequest, b: ReturnRequest): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

/** Removes photo data from list responses (photos can be large; detail pages load them). */
function withoutPhotos(request: ReturnRequest): ReturnRequest {
  const { damagePhotos, ...rest } = request;
  return { ...rest, damagePhotos: damagePhotos ? [] : undefined };
}

/** What a customer may see: no internal AI details beyond the verdict, no refund lock. */
export function toCustomerView(request: ReturnRequest): ReturnRequest {
  const { refundStartedAt: _lock, verification, ...rest } = request;
  return {
    ...rest,
    verification: verification
      ? {
          verdict: verification.verdict,
          // Only rejection reasons are explained to the customer.
          reason: verification.verdict === 'rejected' ? verification.reason : '',
          checkedAt: verification.checkedAt,
        }
      : undefined,
  };
}

/** A customer's own requests, newest first (sorted in memory — no composite index needed). */
export async function listCustomerReturns(customerId: string): Promise<ReturnRequest[]> {
  const snapshot = await getAdminDb().collection(RETURNS_COLLECTION).where('customerId', '==', customerId).get();
  return snapshot.docs.map((doc) => toCustomerView(withoutPhotos(doc.data() as ReturnRequest))).sort(newestFirst);
}

export interface ReturnsPage {
  returns: ReturnRequest[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Admin list, newest first, optionally filtered by status, paginated (page starts at 1). */
export async function listReturns(options: { status?: ReturnStatus; page?: number; pageSize?: number } = {}): Promise<ReturnsPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const collection = getAdminDb().collection(RETURNS_COLLECTION);
  const snapshot = options.status ? await collection.where('status', '==', options.status).get() : await collection.get();
  const all = snapshot.docs.map((doc) => doc.data() as ReturnRequest).sort(newestFirst);
  const start = (page - 1) * pageSize;
  return {
    returns: all.slice(start, start + pageSize).map(withoutPhotos),
    page,
    pageSize,
    total: all.length,
    hasMore: start + pageSize < all.length,
  };
}

/* ------------------------------------------------------------------ */
/* Admin: update                                                       */
/* ------------------------------------------------------------------ */

export interface AdminReturnUpdate {
  status?: ReturnStatus;
  adminDecision?: ReturnDecision;
  resolutionNote?: string;
  storeCreditAmount?: number;
}

export function validateAdminUpdate(body: unknown): ValidationResult<AdminReturnUpdate> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request.' };
  const update: AdminReturnUpdate = {};

  if (body.status !== undefined) {
    if (!RETURN_STATUSES.includes(body.status as ReturnStatus)) return { ok: false, error: 'Unknown status.' };
    update.status = body.status as ReturnStatus;
  }
  if (body.adminDecision !== undefined && body.adminDecision !== '' && body.adminDecision !== null) {
    if (!RETURN_DECISIONS.includes(body.adminDecision as ReturnDecision)) return { ok: false, error: 'Unknown decision.' };
    update.adminDecision = body.adminDecision as ReturnDecision;
  }
  if (body.resolutionNote !== undefined) update.resolutionNote = str(body.resolutionNote, 1000);
  if (body.storeCreditAmount !== undefined && body.storeCreditAmount !== '' && body.storeCreditAmount !== null) {
    const amount = Number(body.storeCreditAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return { ok: false, error: 'Store credit amount must be between 1 and 100000.' };
    }
    update.storeCreditAmount = roundRupees(amount);
  }
  return { ok: true, data: update };
}

/** Field changes + checks shared by every update (no writes). */
function applyUpdate(current: ReturnRequest, update: AdminReturnUpdate, now: string): ReturnRequest {
  if ((current.status === 'resolved' || current.razorpayRefundId) && update.status && update.status !== 'resolved') {
    throw new ReturnValidationError('This request is already resolved and cannot be reopened.', 409);
  }
  if (current.status === 'resolved' && update.adminDecision && update.adminDecision !== current.adminDecision) {
    throw new ReturnValidationError('The decision on a resolved request is final.', 409);
  }
  if (update.adminDecision && current.type !== 'damage_defect') {
    throw new ReturnValidationError('Size exchanges and store credit requests are resolved automatically; no decision is needed.');
  }
  if (update.adminDecision && !decisionsFor(current.paymentMethod).includes(update.adminDecision)) {
    throw new ReturnValidationError('Cash on Delivery orders can only be resolved with an exchange or store credit.');
  }

  const next: ReturnRequest = { ...current, updatedAt: now };
  if (update.status) next.status = update.status;
  if (update.adminDecision) next.adminDecision = update.adminDecision;
  if (update.resolutionNote !== undefined) next.resolutionNote = update.resolutionNote || undefined;
  if (update.storeCreditAmount !== undefined && !current.storeCreditIssuedAt) next.storeCreditAmount = update.storeCreditAmount;
  if (next.status === 'rejected' && current.status !== 'rejected') next.resolvedAt = now;
  if (next.status !== 'rejected' && current.status === 'rejected') next.resolvedAt = undefined;
  return next;
}

/**
 * Applies an admin update. Saving a store_credit decision, or resolving into store credit,
 * requires the admin TPIN (ADMIN_TPIN). When a request is resolved:
 * - store_credit    -> adds a ledger credit to users/{uid}/storeCredit/summary (exactly once, in a transaction)
 * - razorpay_refund -> calls the Razorpay Refund API for the order's payment (prepaid only, exactly once)
 * - exchange        -> just marks it resolved (the replacement is shipped by the team)
 */
export async function updateReturn(
  returnId: string,
  update: AdminReturnUpdate,
  options: { tpin?: string } = {},
): Promise<ReturnRequest> {
  const db = getAdminDb();
  const ref = db.collection(RETURNS_COLLECTION).doc(returnId);

  const preview = await getReturn(returnId);
  if (!preview) throw new ReturnValidationError(`Return ${returnId} was not found.`, 404);
  const previewNext = applyUpdate(preview, update, new Date().toISOString());

  const issuesCredit =
    previewNext.status === 'resolved' && effectiveDecision(previewNext) === 'store_credit' && !preview.storeCreditIssuedAt;
  const setsCreditDecision = update.adminDecision === 'store_credit' && preview.adminDecision !== 'store_credit';
  if (issuesCredit || setsCreditDecision) assertAdminTpin(options.tpin);
  if (
    previewNext.status === 'resolved' &&
    effectiveDecision(previewNext) === 'razorpay_refund' &&
    !preview.razorpayRefundId
  ) {
    return refundViaRazorpay(returnId, update);
  }

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ReturnValidationError(`Return ${returnId} was not found.`, 404);
    const current = snapshot.data() as ReturnRequest;
    const now = new Date().toISOString();
    const next = applyUpdate(current, update, now);
    const decision = effectiveDecision(next);
    const resolving = next.status === 'resolved';

    // Reads must happen before any writes in a Firestore transaction.
    const creditRef = storeCreditRef(current.customerId);
    const needsCredit = resolving && decision === 'store_credit' && !current.storeCreditIssuedAt;
    const creditSnap = needsCredit ? await transaction.get(creditRef) : null;

    if (resolving) {
      if (!decision) {
        throw new ReturnValidationError('Choose a decision (Exchange or Store Credit) before resolving.');
      }
      if (decision === 'razorpay_refund' && !current.razorpayRefundId) {
        throw new ReturnValidationError('The Razorpay refund has not been completed yet. Please try again.', 409);
      }
      next.adminDecision = decision;
      next.resolvedAt = current.resolvedAt ?? now;

      if (needsCredit) {
        const amount = next.storeCreditAmount ?? current.itemPrice;
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new ReturnValidationError('Enter a store credit amount before resolving.');
        }
        writeStoreCreditEntry(
          transaction,
          creditRef,
          creditSnap?.exists ? (creditSnap.data() as Partial<StoreCredit>) : undefined,
          {
            type: 'credit',
            amount,
            reason:
              current.type === 'store_credit'
                ? `Exchange size unavailable — Order ${current.orderId}`
                : `Return approved (${current.reason === 'wrong_item' ? 'wrong item' : 'damaged item'}) — Order ${current.orderId}`,
            orderId: current.orderId,
            returnId: current.returnId,
            createdBy: 'admin',
          },
        );
        next.storeCreditAmount = amount;
        next.storeCreditIssuedAt = now;
      }
    }

    transaction.set(ref, next);
    return next;
  });
}

/**
 * Refunds the returned item's price to the original Razorpay payment, then resolves the request.
 * A lock field stops two admins (or a double-click) from refunding twice.
 */
async function refundViaRazorpay(returnId: string, update: AdminReturnUpdate): Promise<ReturnRequest> {
  const db = getAdminDb();
  const ref = db.collection(RETURNS_COLLECTION).doc(returnId);

  // 1. Take the lock and validate.
  const locked = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ReturnValidationError(`Return ${returnId} was not found.`, 404);
    const current = snapshot.data() as ReturnRequest;
    if (current.razorpayRefundId) throw new ReturnValidationError('This item has already been refunded.', 409);
    if (current.paymentMethod !== 'razorpay') {
      throw new ReturnValidationError('Cash on Delivery orders can only be resolved with an exchange or store credit.');
    }
    if (current.refundStartedAt && Date.now() - Date.parse(current.refundStartedAt) < REFUND_LOCK_MS) {
      throw new ReturnValidationError('A refund for this request is already being processed. Refresh in a minute.', 409);
    }
    const now = new Date().toISOString();
    const next = applyUpdate(current, { ...update, status: undefined }, now);
    next.adminDecision = 'razorpay_refund';
    next.refundStartedAt = now;
    transaction.set(ref, next);
    return next;
  });

  // 2. Call Razorpay (outside the transaction — it must run exactly once).
  const releaseLock = () => ref.update({ refundStartedAt: FieldValue.delete() }).catch(() => undefined);
  const order = await getOrder(locked.orderId).catch(() => null);
  if (!order?.razorpayPaymentId) {
    await releaseLock();
    throw new ReturnValidationError('No Razorpay payment was found for this order, so it cannot be refunded.', 409);
  }

  const amount = roundRupees(locked.itemPrice);
  let refund: { id: string };
  try {
    // If an earlier attempt reached Razorpay but crashed before saving, reuse that refund
    // instead of refunding twice.
    const previous = await getRazorpay()
      .payments.fetchMultipleRefund(order.razorpayPaymentId, { count: 100 })
      .then((list) => list.items.find((item) => item.notes?.returnId === locked.returnId))
      .catch(() => undefined);
    refund = previous ?? await getRazorpay().payments.refund(order.razorpayPaymentId, {
      amount: Math.round(amount * 100),
      speed: 'normal',
      receipt: locked.returnId,
      notes: {
        returnId: locked.returnId,
        orderId: locked.orderId,
        product: locked.itemProductName.slice(0, 200),
        size: locked.itemSize,
      },
    });
  } catch (error) {
    await releaseLock();
    console.error(`[returns] Razorpay refund failed for ${returnId}:`, error);
    const description =
      isRecord(error) && isRecord(error.error) && typeof error.error.description === 'string' ? error.error.description : '';
    throw new ReturnValidationError(`Razorpay could not process the refund${description ? `: ${description}` : '.'}`, 502);
  }

  // 3. Record the refund and resolve.
  const now = new Date().toISOString();
  const resolved: ReturnRequest = {
    ...locked,
    status: 'resolved',
    adminDecision: 'razorpay_refund',
    razorpayRefundId: refund.id,
    refundAmount: amount,
    refundedAt: now,
    refundStartedAt: undefined,
    resolvedAt: locked.resolvedAt ?? now,
    updatedAt: now,
  };
  // Full overwrite: `refundStartedAt` is undefined here, so the lock field is removed.
  await ref.set(resolved);
  return resolved;
}
