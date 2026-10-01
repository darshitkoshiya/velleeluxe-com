/**
 * Order context for the AI support agent (server-only — uses the Firebase Admin SDK).
 *
 * Only order ID, status, total, item names/sizes and the order date are shared —
 * never addresses, phone numbers or payment IDs.
 */
import { getAdminDb } from './firebase-admin';
import type { Order } from './types';

const MAX_ORDERS = 5;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function formatItems(order: Order): string {
  if (!order.items?.length) return 'no items';
  return order.items.map((item) => `${item.quantity}x ${item.productName} (size ${item.size})`).join(', ');
}

function formatOrder(order: Order): string {
  let line = `Order #${order.orderId} — ${order.status} — ₹${order.total} — ${formatItems(order)} — placed ${formatDate(order.createdAt)}`;
  if (order.status === 'shipped' && order.shippingInfo) {
    const { courier, trackingNumber } = order.shippingInfo;
    if (courier || trackingNumber) {
      line += ` — shipped via ${courier || 'courier'}${trackingNumber ? `, tracking ${trackingNumber}` : ''}`;
    }
  }
  return line;
}

/**
 * The customer's last 5 orders, formatted for the support system prompt.
 * Returns '' if the email is blank or there are no orders.
 */
export async function getCustomerSupportContext(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return '';

  // Orders store the email lowercased (see validateOrderRequest in lib/orders.ts).
  // A single-field equality query needs no composite index; sort in memory.
  const snapshot = await getAdminDb().collection('orders').where('customerEmail', '==', normalised).get();
  const orders = snapshot.docs
    .map((doc) => doc.data() as Order)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, MAX_ORDERS);

  if (orders.length === 0) return '';
  return `Customer's recent orders:\n${orders.map(formatOrder).join('\n')}`;
}
