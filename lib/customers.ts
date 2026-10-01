/**
 * Customers (server-only) — built by grouping every order by email.
 * There is no separate `customers` collection; this is a read-only summary.
 */
import { getAdminDb } from './firebase-admin';
import { listOrders } from './orders';
import { getStoreCredit, storeCreditRef } from './store-credit';
import type { Order, ReturnRequest, StoreCreditTransaction } from './types';

export interface CustomerSummary {
  /** Firebase Auth UID if they placed a logged-in order. */
  uid?: string;
  email: string;
  /** From the most recent order's shipping address. */
  name: string;
  phone?: string;
  orderCount: number;
  /** Sum of order totals (INR). */
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
  /** Store credit balance, when they have one. */
  storeCredit?: number;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const orders = await listOrders();

  const groups = new Map<string, Order[]>();
  for (const order of orders) {
    const email = (order.customerEmail ?? '').trim().toLowerCase();
    if (!email) continue;
    const group = groups.get(email);
    if (group) group.push(order);
    else groups.set(email, [order]);
  }

  const customers: CustomerSummary[] = [];
  groups.forEach((group, email) => {
    customers.push(summariseCustomer(email, group));
  });

  // Store credit balances, read in one batch for customers with an account.
  const withUid = customers.filter((customer) => customer.uid);
  if (withUid.length > 0) {
    try {
      const snapshots = await getAdminDb().getAll(...withUid.map((customer) => storeCreditRef(customer.uid as string)));
      snapshots.forEach((snapshot, index) => {
        const balance = snapshot.exists ? snapshot.get('balance') : undefined;
        if (typeof balance === 'number' && balance > 0) withUid[index].storeCredit = balance;
      });
    } catch (error) {
      console.error('[customers] Could not read store credit balances:', error);
    }
  }

  return customers.sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''));
}

/** Builds one customer's summary from all of their orders (any order). */
export function summariseCustomer(email: string, group: Order[]): CustomerSummary {
  const sorted = [...group].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const latestLoggedIn = [...sorted].reverse().find((order) => order.customerId && order.customerId !== 'guest');
  const phone = latest.shippingAddress?.phone || latest.customerPhone;

  return {
    uid: latestLoggedIn?.customerId,
    email,
    name: latest.shippingAddress?.name || latest.customerName || '',
    phone: phone || undefined,
    orderCount: sorted.length,
    totalSpent: sorted
      .filter((order) => order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered')
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    firstOrderAt: first.createdAt,
    lastOrderAt: latest.createdAt,
  };
}

export interface CustomerDetail {
  customer: CustomerSummary;
  /** Every order for this email, newest first. */
  orders: Order[];
  storeCredit: {
    balance: number;
    /** Last 5, newest first. */
    transactions: StoreCreditTransaction[];
    totalTransactions: number;
  };
  /** Razorpay refunds actually processed back to the original payment (INR). */
  totalRefundedToSource: number;
  /** Store credit actually issued for returns (INR). */
  totalRefundedAsCredit: number;
}

/**
 * Full detail for one customer, or null when they have no orders.
 * Refunds live on return requests (the Order type has no refund fields), so they are
 * read from the `returns` collection by email and, for account holders, by UID.
 */
export async function getCustomerDetail(rawEmail: string): Promise<CustomerDetail | null> {
  const email = rawEmail.trim().toLowerCase();
  const all = await listOrders();
  const orders = all.filter((order) => (order.customerEmail ?? '').trim().toLowerCase() === email);
  if (orders.length === 0) return null;

  const customer = summariseCustomer(email, orders);
  const db = getAdminDb();

  let storeCredit: CustomerDetail['storeCredit'] = { balance: 0, transactions: [], totalTransactions: 0 };
  if (customer.uid) {
    try {
      const credit = await getStoreCredit(customer.uid);
      storeCredit = {
        balance: credit.balance,
        transactions: credit.transactions.slice(0, 5),
        totalTransactions: credit.transactions.length,
      };
      if (credit.balance > 0) customer.storeCredit = credit.balance;
    } catch (error) {
      console.error(`[customers] Could not read store credit for ${customer.uid}:`, error);
    }
  }

  let totalRefundedToSource = 0;
  let totalRefundedAsCredit = 0;
  try {
    const returnsCollection = db.collection('returns');
    const snapshots = await Promise.all([
      returnsCollection.where('customerEmail', '==', email).get(),
      ...(customer.uid ? [returnsCollection.where('customerId', '==', customer.uid).get()] : []),
    ]);
    const returns = new Map<string, ReturnRequest>();
    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) returns.set(doc.id, doc.data() as ReturnRequest);
    }
    returns.forEach((request) => {
      if (request.refundedAt && typeof request.refundAmount === 'number') {
        totalRefundedToSource += request.refundAmount;
      }
      if (request.storeCreditIssuedAt && typeof request.storeCreditAmount === 'number') {
        totalRefundedAsCredit += request.storeCreditAmount;
      }
    });
  } catch (error) {
    console.error(`[customers] Could not read returns for ${email}:`, error);
  }

  return {
    customer,
    orders: [...orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    storeCredit,
    totalRefundedToSource: Math.round(totalRefundedToSource * 100) / 100,
    totalRefundedAsCredit: Math.round(totalRefundedAsCredit * 100) / 100,
  };
}
