/**
 * /admin/analytics — revenue, top products, locations and repeat customers.
 * Data comes from lib/analytics.ts (cached 15 minutes, cleared when orders change).
 */
import { getAnalytics, type AnalyticsSummary, type DailyRevenue } from '@/lib/analytics';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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
const sectionTitle: React.CSSProperties = { fontSize: '16px', fontWeight: 600, margin: '0 0 16px' };

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  borderBottom: '1px solid #e5e5e5',
  color: '#6F6A62',
  fontWeight: 500,
  fontSize: '12px',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' };
const num: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };

/** "+12% vs last month", or null when there is nothing to compare against. */
function percentChange(current: number, previous: number): { text: string; colour: string } | null {
  if (previous <= 0) return current > 0 ? { text: 'New this month', colour: '#2E7D32' } : null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  return {
    text: `${rounded >= 0 ? '+' : ''}${rounded}% vs last month`,
    colour: rounded > 0 ? '#2E7D32' : rounded < 0 ? '#C0392B' : '#6F6A62',
  };
}

function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function RevenueChart({ data }: { data: DailyRevenue[] }) {
  const width = 900;
  const chartHeight = 120;
  const top = 20;
  const left = 70;
  const bottom = 28;
  const height = top + chartHeight + bottom;
  const plotWidth = width - left - 10;
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(slot * 0.7, 2);
  const max = Math.max(...data.map((d) => d.revenue), 0);
  const baseline = top + chartHeight;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Daily revenue for the last 30 days"
    >
      {/* Y axis: max value and zero */}
      <line x1={left} y1={top} x2={left} y2={baseline} stroke="#e5e5e5" />
      <line x1={left} y1={top} x2={width - 10} y2={top} stroke="#f0f0f0" strokeDasharray="4 4" />
      <text x={left - 8} y={top + 4} textAnchor="end" fontSize="11" fill="#6F6A62">
        {formatPrice(max)}
      </text>
      <text x={left - 8} y={baseline + 4} textAnchor="end" fontSize="11" fill="#6F6A62">
        {formatPrice(0)}
      </text>
      <line x1={left} y1={baseline} x2={width - 10} y2={baseline} stroke="#e5e5e5" />

      {data.map((d, i) => {
        const isZero = d.revenue <= 0 || max <= 0;
        const barHeight = isZero ? 2 : Math.max((d.revenue / max) * chartHeight, 2);
        const x = left + i * slot + (slot - barWidth) / 2;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={baseline - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              fill={isZero ? '#DDD8CF' : '#1C2230'}
            >
              <title>{`${shortDate(d.date)}: ${formatPrice(d.revenue)} (${d.orderCount} order${d.orderCount === 1 ? '' : 's'})`}</title>
            </rect>
            {i % 5 === 0 ? (
              <text x={x + barWidth / 2} y={baseline + 18} textAnchor="middle" fontSize="11" fill="#6F6A62">
                {shortDate(d.date)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export default async function AdminAnalyticsPage() {
  let data: AnalyticsSummary | null = null;
  try {
    data = await getAnalytics();
  } catch (error) {
    console.error('[admin] Failed to load analytics:', error);
  }

  if (!data) {
    return (
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Analytics</h1>
        <p style={{ ...card, borderColor: '#C8623D', color: '#C8623D' }}>
          Could not load analytics from the database. Check the Firebase Admin settings in your environment variables.
        </p>
      </div>
    );
  }

  const revenueChange = percentChange(data.revenueThisMonth, data.revenueLastMonth);
  const last30Revenue = data.dailyRevenue.reduce((sum, d) => sum + d.revenue, 0);
  const repeatRate = Math.round(data.repeatCustomerRate * 10) / 10;

  const stats: { label: string; value: string; hint: string; change?: { text: string; colour: string } | null }[] = [
    { label: 'Total revenue', value: formatPrice(data.totalRevenue), hint: `All time · ${data.totalOrders} paid orders` },
    {
      label: 'This month revenue',
      value: formatPrice(data.revenueThisMonth),
      hint: `Last month: ${formatPrice(data.revenueLastMonth)}`,
      change: revenueChange,
    },
    { label: 'Orders this month', value: String(data.ordersThisMonth), hint: 'Paid orders only' },
    { label: 'Avg order value', value: formatPrice(Math.round(data.averageOrderValue)), hint: 'All time, paid orders' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px' }}>Analytics</h1>
      <p style={{ ...cardHint, marginBottom: '24px' }}>
        Paid orders only (confirmed, processing, shipped, delivered). Updates every 15 minutes or when an order changes.
      </p>

      {/* Row 1 — summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {stats.map((stat) => (
          <div key={stat.label} style={card}>
            <p style={cardValue}>{stat.value}</p>
            <p style={cardLabel}>{stat.label}</p>
            <p style={{ ...cardHint, marginTop: '8px' }}>{stat.hint}</p>
            {stat.change ? (
              <p style={{ ...cardHint, marginTop: '4px', color: stat.change.colour, fontWeight: 500 }}>{stat.change.text}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Row 2 — revenue chart */}
      <div style={{ ...card, marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={sectionTitle}>Revenue — last 30 days</h2>
          <p style={cardHint}>{formatPrice(last30Revenue)} total</p>
        </div>
        <RevenueChart data={data.dailyRevenue} />
      </div>

      {/* Row 3 — top products + top locations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
          marginTop: '24px',
          alignItems: 'start',
        }}
      >
        <div style={{ ...card, overflowX: 'auto' }}>
          <h2 style={sectionTitle}>Top products</h2>
          {data.topProducts.length === 0 ? (
            <p style={cardHint}>No paid orders yet.</p>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Product</th>
                  <th style={{ ...th, ...num }}>Units</th>
                  <th style={{ ...th, ...num }}>Revenue</th>
                  <th style={{ ...th, ...num }}>Views (30d)</th>
                  <th style={{ ...th, ...num }}>Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product, index) => (
                  <tr key={product.productId}>
                    <td style={{ ...td, color: '#6F6A62' }}>{index + 1}</td>
                    <td style={td}>
                      {product.slug ? (
                        <a href={`/product/${product.slug}`} style={{ color: '#1C2230' }}>
                          {product.productName}
                        </a>
                      ) : (
                        product.productName
                      )}
                    </td>
                    <td style={{ ...td, ...num }}>{product.unitsSold}</td>
                    <td style={{ ...td, ...num }}>{formatPrice(product.revenue)}</td>
                    <td style={{ ...td, ...num }}>{product.views}</td>
                    <td style={{ ...td, ...num }}>{product.views > 0 ? `${product.conversionRate.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...card, overflowX: 'auto' }}>
          <h2 style={sectionTitle}>Top locations</h2>
          {data.locationStats.length === 0 ? (
            <p style={cardHint}>No paid orders yet.</p>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>City, State</th>
                  <th style={{ ...th, ...num }}>Orders</th>
                  <th style={{ ...th, ...num }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.locationStats.map((location) => (
                  <tr key={`${location.city}::${location.state}`}>
                    <td style={td}>{location.state ? `${location.city}, ${location.state}` : location.city}</td>
                    <td style={{ ...td, ...num }}>{location.orderCount}</td>
                    <td style={{ ...td, ...num }}>{formatPrice(location.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 4 — repeat customers */}
      <div style={{ ...card, marginTop: '24px' }}>
        <h2 style={sectionTitle}>Repeat customers</h2>
        <p style={{ fontSize: '15px', margin: '0 0 12px' }}>
          <strong style={{ fontSize: '24px' }}>{repeatRate}%</strong> of customers have ordered more than once
        </p>
        <div style={{ background: '#EEEAE3', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(Math.max(data.repeatCustomerRate, 0), 100)}%`,
              height: '100%',
              background: '#1C2230',
              borderRadius: '999px',
            }}
          />
        </div>
      </div>
    </div>
  );
}
