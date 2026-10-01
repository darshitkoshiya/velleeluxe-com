/**
 * /admin — dashboard with order totals. Reads Firestore on every request.
 */
import SyncProductsCard from '@/components/admin/SyncProductsCard';
import { getNotifications } from '@/lib/admin-notifications';
import { listOrders } from '@/lib/orders';
import type { Order } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '20px',
};

const cardLabel: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
  margin: 0,
};

const cardValue: React.CSSProperties = { fontSize: '32px', fontWeight: 600, margin: '8px 0 4px' };
const cardHint: React.CSSProperties = { fontSize: '13px', color: '#6F6A62', margin: 0 };

const linkButton: React.CSSProperties = {
  display: 'inline-block',
  background: '#1C2230',
  color: '#F6F1E8',
  padding: '12px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
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

  /** Unresolved notifications; null if they could not be loaded. */
  let openNotifications: number | null = null;
  try {
    openNotifications = (await getNotifications(true)).length;
  } catch (error) {
    console.error('[admin] Failed to load notifications for dashboard:', error);
  }

  const today = istDate(new Date());
  const todaysOrders = orders.filter((order) => istDate(order.createdAt) === today);
  const revenue = orders.filter(countsAsRevenue).reduce((sum, order) => sum + (order.total || 0), 0);
  const pending = orders.filter((order) => order.status === 'pending').length;
  const toShip = orders.filter((order) => order.status === 'confirmed' || order.status === 'processing').length;

  const stats = [
    { label: 'Total orders', value: String(orders.length), hint: 'All time' },
    { label: "Today's orders", value: String(todaysOrders.length), hint: 'Since midnight (India time)' },
    { label: 'Total revenue', value: formatPrice(revenue), hint: 'Excludes cancelled and unpaid orders' },
    { label: 'Pending orders', value: String(pending), hint: 'Online payment not completed yet' },
    { label: 'Ready to ship', value: String(toShip), hint: 'Confirmed or processing' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Dashboard</h1>

      {loadError ? (
        <p style={{ ...card, borderColor: '#C8623D', color: '#C8623D', marginBottom: '24px' }}>{loadError}</p>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {stats.map((stat) => (
          <div key={stat.label} style={card}>
            <p style={cardLabel}>{stat.label}</p>
            <p style={cardValue}>{stat.value}</p>
            <p style={cardHint}>{stat.hint}</p>
          </div>
        ))}

        <a
          href="/admin/notifications"
          style={{
            ...card,
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            borderColor: openNotifications ? '#C0392B' : '#e5e5e5',
          }}
        >
          <p style={{ ...cardLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">🔔</span> Notifications
            {openNotifications ? (
              <span
                aria-label={`${openNotifications} unresolved`}
                style={{
                  background: '#C0392B',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '1px 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: 0,
                }}
              >
                {openNotifications}
              </span>
            ) : null}
          </p>
          {openNotifications === null ? (
            <p style={{ ...cardValue, fontSize: '18px', color: '#6F6A62' }}>Unavailable</p>
          ) : openNotifications === 0 ? (
            <p style={{ ...cardValue, fontSize: '24px', color: '#6F6A62' }}>All clear</p>
          ) : (
            <p style={{ ...cardValue, color: '#C0392B' }}>{openNotifications}</p>
          )}
          <p style={cardHint}>
            {openNotifications
              ? `${openNotifications} unresolved issue${openNotifications === 1 ? '' : 's'} →`
              : 'View notifications →'}
          </p>
        </a>
      </div>

      <SyncProductsCard />

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', flexWrap: 'wrap' }}>
        <a href="/admin/orders" style={linkButton}>
          View all orders
        </a>
        <a href="/admin/returns" style={{ ...linkButton, background: '#fff', color: '#1C2230', border: '1px solid #1C2230' }}>
          Returns &amp; exchanges
        </a>
        <a href="/admin/settings" style={{ ...linkButton, background: '#fff', color: '#1C2230', border: '1px solid #1C2230' }}>
          Settings
        </a>
        <a href="/admin/suppliers" style={{ ...linkButton, background: '#fff', color: '#1C2230', border: '1px solid #1C2230' }}>
          Suppliers
        </a>
      </div>
    </div>
  );
}
