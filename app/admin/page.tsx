/**
 * /admin — dashboard: KPIs, 7-day sales trend, order status breakdown, low stock and recent orders.
 * Server component; reads Firestore on every request.
 */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getNotifications } from '@/lib/admin-notifications';
import { getAllSkus, getListings } from '@/lib/catalog-admin';
import { listOrders } from '@/lib/orders';
import { listReturns } from '@/lib/returns';
import type { Order, OrderStatus, ProductSku } from '@/lib/types';
import StatCard from '@/components/admin/ui/StatCard';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import EmptyState from '@/components/admin/ui/EmptyState';
import SalesChart from '@/components/admin/SalesChart';
import OrderStatusChart from '@/components/admin/OrderStatusChart';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 5;
const SERIF = 'var(--font-newsreader), Georgia, serif';

/** "YYYY-MM-DD" in Indian time, so "today" matches Darshit's day. */
function istDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Revenue counts orders that are real sales: not cancelled, and not unpaid online orders. */
function countsAsRevenue(order: Order): boolean {
  return order.status !== 'cancelled' && order.status !== 'pending';
}

/** Last `days` IST calendar days (oldest first) as { key: "YYYY-MM-DD", label: "Apr 18" }. */
function lastDays(days: number, offset = 0): { key: string; label: string }[] {
  const now = Date.now();
  const result: { key: string; label: string }[] = [];
  for (let i = days - 1 + offset; i >= offset; i -= 1) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    result.push({
      key: istDate(d),
      label: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }),
    });
  }
  return result;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
}

const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

/* ---------- inline icons (18px, stroke) ---------- */

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const RupeeIcon = () => (
  <svg {...iconProps}>
    <path d="M6 4h12M6 9h12M14 4c3 0 3 10-3 10H7l8 7" />
  </svg>
);
const OrderIcon = () => (
  <svg {...iconProps}>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const BoxIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </svg>
);
const ReturnIcon = () => (
  <svg {...iconProps}>
    <path d="M9 14l-5-5 5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

/* ---------- table styles ---------- */

const panel: CSSProperties = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  padding: 24,
  minWidth: 0,
};

const panelHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 16,
};

const panelTitle: CSSProperties = { fontFamily: SERIF, fontSize: 18, fontWeight: 400, margin: 0 };
const panelLink: CSSProperties = { fontSize: 12, color: 'var(--admin-gold)', textDecoration: 'none' };

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--admin-text-muted)',
  padding: '0 8px 10px',
  borderBottom: '1px solid var(--admin-border)',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  fontSize: 13,
  padding: '12px 8px',
  borderBottom: '1px solid var(--admin-border-light)',
  color: 'var(--admin-text)',
  verticalAlign: 'middle',
};

export default async function AdminDashboardPage() {
  let orders: Order[] = [];
  let loadError: string | null = null;
  try {
    orders = await listOrders();
  } catch (error) {
    console.error('[admin] Failed to load orders for dashboard:', error);
    loadError = 'Could not load orders from the database. Check the Firebase Admin settings in your environment variables.';
  }

  let openNotifications: number | null = null;
  try {
    openNotifications = (await getNotifications(true)).length;
  } catch (error) {
    console.error('[admin] Failed to load notifications for dashboard:', error);
  }

  let returnsCount = 0;
  try {
    returnsCount = (await listReturns({ pageSize: 1 })).total;
  } catch (error) {
    console.error('[admin] Failed to load returns for dashboard:', error);
  }

  /** Low stock: in stock but at or below the threshold. Product title comes from the parent listing. */
  let lowStock: (ProductSku & { title: string })[] = [];
  try {
    const [skus, listings] = await Promise.all([getAllSkus(), getListings()]);
    const titles = new Map(listings.map((l) => [l.id, l.title]));
    lowStock = skus
      .filter((s) => s.stockQuantity > 0 && s.stockQuantity <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 10)
      .map((s) => ({ ...s, title: titles.get(s.listingId) ?? '' }));
  } catch (error) {
    console.error('[admin] Failed to load low stock SKUs for dashboard:', error);
  }

  /* ---------- KPIs ---------- */
  const totalRevenue = orders.filter(countsAsRevenue).reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const readyToShip = orders.filter((o) => o.status === 'confirmed' || o.status === 'processing').length;

  /* ---------- daily data (last 7 IST days, zero-filled) ---------- */
  const revenueByDay = new Map<string, number>();
  const ordersByDay = new Map<string, number>();
  for (const order of orders) {
    const key = istDate(order.createdAt);
    if (!key) continue;
    ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    if (countsAsRevenue(order)) revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + (order.total || 0));
  }
  const dailyData = lastDays(7).map(({ key, label }) => ({
    date: label,
    revenue: revenueByDay.get(key) ?? 0,
    orders: ordersByDay.get(key) ?? 0,
  }));

  /* Revenue change: last 7 days vs the 7 days before. */
  const thisWeek = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  const lastWeek = lastDays(7, 7).reduce((sum, { key }) => sum + (revenueByDay.get(key) ?? 0), 0);
  let revenueChange: string | undefined;
  let revenueChangePositive: boolean | undefined;
  if (lastWeek > 0) {
    const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
    revenueChange = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    revenueChangePositive = pct >= 0;
  }

  /* ---------- status breakdown ---------- */
  const statusCounts = new Map<string, number>();
  for (const order of orders) statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
  const knownStatuses: string[] = [...STATUS_ORDER];
  const extraStatuses = [...statusCounts.keys()].filter((s) => !knownStatuses.includes(s));
  const statusBreakdown = [...knownStatuses, ...extraStatuses].map((status) => {
    const count = statusCounts.get(status) ?? 0;
    return { status, count, percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0 };
  });

  /* ---------- recent orders ---------- */
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 12,
            color: 'var(--admin-text-muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: '0 0 4px',
          }}
        >
          Admin Dashboard · {formattedDate}
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, color: 'var(--admin-text)', margin: '0 0 4px', fontWeight: 400 }}>
          Welcome back, Admin
        </h1>
        <p style={{ fontSize: 14, color: 'var(--admin-text-muted)', margin: 0 }}>
          Here&apos;s what&apos;s happening with your store today.
        </p>
      </div>

      {loadError && (
        <p
          style={{
            ...panel,
            padding: '14px 18px',
            borderColor: '#C8623D',
            color: '#9A3B1E',
            fontSize: 13,
            margin: '0 0 20px',
          }}
        >
          {loadError}
        </p>
      )}

      {openNotifications ? (
        <Link
          href="/admin/notifications"
          style={{
            ...panel,
            display: 'block',
            padding: '12px 18px',
            borderColor: '#C8623D',
            color: '#9A3B1E',
            fontSize: 13,
            textDecoration: 'none',
            marginBottom: 20,
          }}
        >
          {openNotifications} unresolved notification{openNotifications === 1 ? '' : 's'} — review now →
        </Link>
      ) : null}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          label="Total Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          icon={<RupeeIcon />}
          change={revenueChange}
          changePositive={revenueChangePositive}
          subtitle="Excl. cancelled & unpaid"
        />
        <StatCard label="Total Orders" value={totalOrders} icon={<OrderIcon />} subtitle="All time" />
        <StatCard
          label="Pending Orders"
          value={pendingOrders}
          icon={<ClockIcon />}
          href="/admin/orders?status=pending"
          subtitle="Payment not completed"
        />
        <StatCard
          label="Ready to Ship"
          value={readyToShip}
          icon={<BoxIcon />}
          href="/admin/orders?status=confirmed"
          subtitle="Confirmed or processing"
        />
        <StatCard
          label="Returns & Exchanges"
          value={returnsCount}
          icon={<ReturnIcon />}
          href="/admin/returns"
          subtitle="All requests"
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, marginBottom: 28 }}>
        <SalesChart data={dailyData} period="7d" />
        <OrderStatusChart statuses={statusBreakdown} />
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
        {/* Low stock */}
        <div style={panel}>
          <div style={panelHeader}>
            <h2 style={panelTitle}>Low Stock Products</h2>
            <Link href="/admin/catalog/inventory" style={panelLink}>
              View all →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState
              title="No low stock alerts"
              description={`Products will appear here when stock drops below ${LOW_STOCK_THRESHOLD} units.`}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Product</th>
                    <th style={th}>Size</th>
                    <th style={th}>Stock</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((sku) => (
                    <tr key={sku.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>{sku.title || sku.sku}</div>
                        {sku.title && (
                          <div style={{ fontSize: 11, color: 'var(--admin-text-subtle)', marginTop: 2 }}>{sku.sku}</div>
                        )}
                      </td>
                      <td style={td}>{sku.size || '—'}</td>
                      <td style={td}>
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: 24,
                            textAlign: 'center',
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: '#F5E1DA',
                            color: '#9A3B1E',
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {sku.stockQuantity}
                        </span>
                      </td>
                      <td style={td}>
                        <StatusBadge status="low_stock" size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div style={panel}>
          <div style={panelHeader}>
            <h2 style={panelTitle}>Recent Orders</h2>
            <Link href="/admin/orders" style={panelLink}>
              View all orders →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="New orders will show up here as soon as they are placed." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Order #</th>
                    <th style={th}>Customer</th>
                    <th style={th}>Items</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={th}>Status</th>
                    <th style={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const itemCount = (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    return (
                      <tr key={order.orderId}>
                        <td style={td}>
                          <Link
                            href={`/admin/orders?search=${encodeURIComponent(order.orderId)}`}
                            style={{ color: 'var(--admin-text)', fontWeight: 500, textDecoration: 'none' }}
                          >
                            {order.orderId}
                          </Link>
                        </td>
                        <td style={td}>{order.customerName || '—'}</td>
                        <td style={td}>{itemCount}</td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ₹{(order.total || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={td}>
                          <StatusBadge status={order.status} size="sm" />
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>
                          {shortDate(order.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
