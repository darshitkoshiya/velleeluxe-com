/**
 * Return / exchange rules and labels shared by the browser and the server.
 * (No Firebase imports here, so client components can use it safely.)
 *
 * Policy: COD orders end in an exchange or store credit (never cash). Prepaid (Razorpay)
 * damage/defect requests may, rarely, be refunded to the original payment via Razorpay.
 */
import type { Order, PaymentMethod, ReturnDecision, ReturnReason, ReturnStatus, ReturnType } from './types';

/** Customers can request an exchange / store credit for this many days after delivery. */
export const RETURN_WINDOW_DAYS = 7;

/** Damage/defect requests must include 1 to this many photos. */
export const MAX_DAMAGE_PHOTOS = 5;

/**
 * Photos are stored as base64 inside the Firestore document (1 MB limit per document),
 * so the combined size is capped well below that.
 */
export const MAX_DAMAGE_PHOTOS_TOTAL_CHARS = 850_000;

/** Older orders within this many days are checked for photo re-use (returning an old shirt). */
export const PHOTO_CHECK_LOOKBACK_DAYS = 90;

/** Every status, in admin dropdown order. */
export const RETURN_STATUSES: ReturnStatus[] = [
  'pending_review',
  'requested',
  'pickup_scheduled',
  'received',
  'inspecting',
  'resolved',
  'rejected',
];

/** The customer-facing progress timeline (pending_review / rejected are shown separately). */
export const RETURN_TIMELINE: ReturnStatus[] = ['requested', 'pickup_scheduled', 'received', 'inspecting', 'resolved'];

export const RETURN_TYPES: ReturnType[] = ['size_exchange', 'store_credit', 'damage_defect'];

export const RETURN_REASONS: ReturnReason[] = ['size_doesnt_fit', 'wrong_item', 'damaged_defective'];

export const RETURN_DECISIONS: ReturnDecision[] = ['exchange', 'store_credit', 'razorpay_refund'];

/** Decisions the admin may pick for a request (Razorpay refund only for prepaid orders). */
export function decisionsFor(paymentMethod: PaymentMethod): ReturnDecision[] {
  return paymentMethod === 'razorpay' ? RETURN_DECISIONS : RETURN_DECISIONS.filter((d) => d !== 'razorpay_refund');
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending_review: 'Under Review',
  requested: 'Approved',
  pickup_scheduled: 'Pickup Scheduled',
  received: 'Received',
  inspecting: 'Inspecting',
  resolved: 'Resolved',
  rejected: 'Not Approved',
};

export const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
  size_exchange: 'Size Exchange',
  store_credit: 'Store Credit',
  damage_defect: 'Damage / Defect',
};

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  size_doesnt_fit: "Size doesn't fit",
  wrong_item: 'Received wrong item',
  damaged_defective: 'Item is damaged or defective',
};

export const RETURN_DECISION_LABELS: Record<ReturnDecision, string> = {
  exchange: 'Exchange (same size)',
  store_credit: 'Store Credit',
  razorpay_refund: 'Refund via Razorpay',
};

/** The request type each reason leads to (size flow may switch to store_credit if no size is available). */
export function typeForReason(reason: ReturnReason): ReturnType {
  return reason === 'size_doesnt_fit' ? 'size_exchange' : 'damage_defect';
}

/**
 * Day the return window ends. Orders have no separate "deliveredAt" field,
 * so `updatedAt` of a delivered order is used (it is set when the status changes).
 */
export function returnWindowEnds(order: Pick<Order, 'status' | 'updatedAt'>): Date | null {
  if (order.status !== 'delivered') return null;
  const delivered = Date.parse(order.updatedAt);
  if (Number.isNaN(delivered)) return null;
  return new Date(delivered + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** True while a delivered order is still inside the return window. */
export function isWithinReturnWindow(order: Pick<Order, 'status' | 'updatedAt'>, now: Date = new Date()): boolean {
  const ends = returnWindowEnds(order);
  return ends !== null && now.getTime() <= ends.getTime();
}

/**
 * The outcome that applies when a request is resolved. Size exchanges and store-credit
 * requests are automatic; damage/defect requests need the admin's decision.
 */
export function effectiveDecision(request: { type: ReturnType; adminDecision?: ReturnDecision }): ReturnDecision | undefined {
  if (request.type === 'size_exchange') return 'exchange';
  if (request.type === 'store_credit') return 'store_credit';
  return request.adminDecision;
}

/** Firestore path segments for a customer's store credit document. */
export const STORE_CREDIT_COLLECTION = 'storeCredit';
export const STORE_CREDIT_DOC = 'summary';
