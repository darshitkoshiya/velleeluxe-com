/**
 * Server-side order logic shared by the API routes.
 *
 * - Validates what the browser sends.
 * - Re-prices every item from the live catalogue (never trusts client prices).
 * - Saves orders to Firestore (source of truth) and copies them to Google Sheets.
 * - Marks orders as paid exactly once, so emails are never sent twice.
 */
import { getAdminDb } from './firebase-admin';
import { appendOrder, getProducts, updateOrderInSheet } from './sheets';
import { sendOrderConfirmation, sendOrderNotification } from './resend';
import { DEFAULT_SETTINGS, getStoreSettings } from './settings';
import type {
  Address,
  CreateOrderRequest,
  Order,
  OrderItem,
  OrderRequestItem,
  OrderStatus,
  PaymentMethod,
  ShippingInfo,
} from './types';
import {
  calculateShipping,
  generateOrderId,
  isValidEmail,
  isValidPincode,
  MAX_QUANTITY_PER_ITEM,
  normaliseIndianPhone,
} from './utils';

const ORDERS_COLLECTION = 'orders';

/** Thrown for problems the customer can fix (bad input, unavailable product). */
export class OrderValidationError extends Error {}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateAddress(value: unknown): ValidationResult<Address> {
  if (!isRecord(value)) return { ok: false, error: 'Shipping address is missing.' };
  const phone = normaliseIndianPhone(str(value.phone));
  const address: Address = {
    name: str(value.name, 100),
    phone: phone ?? '',
    line1: str(value.line1),
    line2: str(value.line2) || undefined,
    city: str(value.city, 100),
    state: str(value.state, 100),
    pincode: str(value.pincode, 6),
    country: 'India',
  };
  if (address.name.length < 2) return { ok: false, error: 'Please enter the recipient name.' };
  if (!phone) return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
  if (!address.line1) return { ok: false, error: 'Please enter your address.' };
  if (!address.city) return { ok: false, error: 'Please enter your city.' };
  if (!address.state) return { ok: false, error: 'Please select your state.' };
  if (!isValidPincode(address.pincode)) return { ok: false, error: 'Please enter a valid 6-digit pincode.' };
  return { ok: true, data: address };
}

function validateItems(value: unknown): ValidationResult<OrderRequestItem[]> {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: 'Your cart is empty.' };
  if (value.length > 50) return { ok: false, error: 'Too many items in one order.' };
  const items: OrderRequestItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return { ok: false, error: 'Invalid cart item.' };
    const quantity = Number(raw.quantity);
    const item: OrderRequestItem = {
      productId: str(raw.productId),
      size: str(raw.size, 10).toUpperCase(),
      quantity,
    };
    if (!item.productId || !item.size) return { ok: false, error: 'Invalid cart item.' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      return { ok: false, error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` };
    }
    items.push(item);
  }
  return { ok: true, data: items };
}

export function validateOrderRequest(body: unknown): ValidationResult<CreateOrderRequest> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request.' };

  const customerEmail = str(body.customerEmail, 200).toLowerCase();
  if (!isValidEmail(customerEmail)) return { ok: false, error: 'Please enter a valid email address.' };

  const paymentMethod = body.paymentMethod as PaymentMethod;
  if (paymentMethod !== 'razorpay' && paymentMethod !== 'cod') {
    return { ok: false, error: 'Please choose a payment method.' };
  }

  const address = validateAddress(body.shippingAddress);
  if (!address.ok) return address;

  const items = validateItems(body.items);
  if (!items.ok) return items;

  return {
    ok: true,
    data: {
      customerName: str(body.customerName, 100) || address.data.name,
      customerEmail,
      customerPhone: address.data.phone,
      shippingAddress: address.data,
      items: items.data,
      paymentMethod,
      notes: str(body.notes, 500) || undefined,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Building & saving                                                   */
/* ------------------------------------------------------------------ */

/** Creates a full Order, pricing every line from the live catalogue. */
export async function buildOrder(request: CreateOrderRequest, customerId: string): Promise<Order> {
  const products = await getProducts();
  if (products.length === 0) {
    throw new Error('Product catalogue is unavailable.');
  }
  const byId = new Map(products.map((product) => [product.id, product]));

  // Merge duplicate lines (same product + size).
  const merged = new Map<string, OrderRequestItem>();
  for (const item of request.items) {
    const key = `${item.productId}::${item.size}`;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : item);
  }

  const items: OrderItem[] = [];
  for (const item of Array.from(merged.values())) {
    const product = byId.get(item.productId);
    if (!product) {
      throw new OrderValidationError('One of the items in your cart is no longer available. Please review your cart.');
    }
    if (product.sizes.length > 0 && !product.sizes.includes(item.size)) {
      throw new OrderValidationError(`Size ${item.size} is not available for ${product.name}.`);
    }
    if (product.stock !== 'unlimited' && product.stock < item.quantity) {
      throw new OrderValidationError(`${product.name} is out of stock in the quantity requested.`);
    }
    items.push({
      productId: product.id,
      productName: product.name,
      size: item.size,
      quantity: Math.min(item.quantity, MAX_QUANTITY_PER_ITEM),
      price: product.price,
      image: product.images[0],
      slug: product.slug,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Free-shipping threshold comes from the admin panel (falls back to the default if unreadable).
  let freeShippingThreshold = DEFAULT_SETTINGS.freeShippingThreshold;
  try {
    freeShippingThreshold = (await getStoreSettings()).freeShippingThreshold;
  } catch (error) {
    console.error('[orders] Could not read store settings; using default free-shipping threshold:', error);
  }
  const shippingFee = calculateShipping(subtotal, freeShippingThreshold);
  const now = new Date().toISOString();

  return {
    orderId: generateOrderId(),
    customerId,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    shippingAddress: request.shippingAddress,
    items,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    paymentMethod: request.paymentMethod,
    // COD orders are confirmed immediately; online orders wait for payment.
    status: request.paymentMethod === 'cod' ? 'confirmed' : 'pending',
    createdAt: now,
    updatedAt: now,
    notes: request.notes,
  };
}

/** Saves to Firestore, then copies to Sheets (a Sheets failure never loses the order). */
export async function saveNewOrder(order: Order): Promise<void> {
  await getAdminDb().collection(ORDERS_COLLECTION).doc(order.orderId).set(order);
  try {
    await appendOrder(order);
  } catch (error) {
    console.error(`[orders] Could not copy order ${order.orderId} to Google Sheets:`, error);
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const snapshot = await getAdminDb().collection(ORDERS_COLLECTION).doc(orderId).get();
  return snapshot.exists ? (snapshot.data() as Order) : null;
}

export async function findOrderIdByRazorpayOrderId(razorpayOrderId: string): Promise<string | null> {
  const snapshot = await getAdminDb()
    .collection(ORDERS_COLLECTION)
    .where('razorpayOrderId', '==', razorpayOrderId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

async function safeSheetUpdate(orderId: string, updates: Parameters<typeof updateOrderInSheet>[1]) {
  try {
    await updateOrderInSheet(orderId, updates);
  } catch (error) {
    console.error(`[orders] Could not update order ${orderId} in Google Sheets:`, error);
  }
}

/** Stores the Razorpay order ID against our order. */
export async function attachRazorpayOrder(orderId: string, razorpayOrderId: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  await getAdminDb().collection(ORDERS_COLLECTION).doc(orderId).update({ razorpayOrderId, updatedAt });
  await safeSheetUpdate(orderId, { razorpayOrderId, updatedAt });
}

/**
 * Moves a pending order to "confirmed" after payment.
 * Runs in a transaction so the verify route and the webhook can both call it
 * safely — `changed` is true only for the call that actually confirmed it.
 */
export async function markOrderPaid(
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ order: Order; changed: boolean }> {
  const db = getAdminDb();
  const ref = db.collection(ORDERS_COLLECTION).doc(orderId);

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error(`Order ${orderId} not found.`);
    const order = snapshot.data() as Order;
    if (order.status !== 'pending') {
      return { order, changed: false };
    }
    const updatedAt = new Date().toISOString();
    const updated: Order = { ...order, status: 'confirmed', razorpayOrderId, razorpayPaymentId, updatedAt };
    transaction.update(ref, { status: 'confirmed', razorpayOrderId, razorpayPaymentId, updatedAt });
    return { order: updated, changed: true };
  });

  if (result.changed) {
    await safeSheetUpdate(orderId, {
      status: 'confirmed',
      razorpayOrderId,
      razorpayPaymentId,
      updatedAt: result.order.updatedAt,
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

/**
 * Every order, newest first. With `status`, only orders in that status.
 * (Sorted in memory so no composite Firestore index is needed.)
 */
export async function listOrders(status?: OrderStatus): Promise<Order[]> {
  const collection = getAdminDb().collection(ORDERS_COLLECTION);
  const snapshot = status
    ? await collection.where('status', '==', status).get()
    : await collection.orderBy('createdAt', 'desc').get();
  const orders = snapshot.docs.map((doc) => doc.data() as Order);
  return orders.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Only orders in these statuses can be marked as shipped. */
export const SHIPPABLE_STATUSES: OrderStatus[] = ['confirmed', 'processing'];

export class OrderNotShippableError extends Error {}

/**
 * Marks a confirmed/processing order as shipped (Firestore + Google Sheets).
 * Runs in a transaction so a double-click can't ship (and email) twice.
 */
export async function markOrderShipped(
  orderId: string,
  details: { courier?: string; trackingNumber?: string },
): Promise<Order> {
  const db = getAdminDb();
  const ref = db.collection(ORDERS_COLLECTION).doc(orderId);
  const now = new Date().toISOString();
  const shippingInfo: ShippingInfo = {
    courier: details.courier || undefined,
    trackingNumber: details.trackingNumber || undefined,
    shippedAt: now,
  };

  const updated = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new OrderNotShippableError(`Order ${orderId} was not found.`);
    const order = snapshot.data() as Order;
    if (!SHIPPABLE_STATUSES.includes(order.status)) {
      throw new OrderNotShippableError(`Order ${orderId} is "${order.status}" and cannot be marked as shipped.`);
    }
    transaction.update(ref, { status: 'shipped', shippingInfo, updatedAt: now });
    return { ...order, status: 'shipped', shippingInfo, updatedAt: now } as Order;
  });

  await safeSheetUpdate(orderId, { status: 'shipped', updatedAt: now });
  return updated;
}

/** Sends the customer confirmation + the owner notification. Email failures are logged, not thrown. */
export async function notifyOrderPlaced(order: Order): Promise<void> {
  const results = await Promise.allSettled([sendOrderConfirmation(order), sendOrderNotification(order)]);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const which = index === 0 ? 'customer confirmation' : 'owner notification';
      console.error(`[orders] Failed to send ${which} email for ${order.orderId}:`, result.reason);
    }
  });
}
