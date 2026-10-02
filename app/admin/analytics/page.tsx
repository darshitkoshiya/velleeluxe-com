/**
 * /admin/analytics — revenue, top products, locations and repeat customers.
 * Data comes from lib/analytics.ts (cached 15 minutes, cleared when orders change).
 */
import type { CSSProperties } from 'react';
import { getAnalytics, type AnalyticsSummary, type DailyRevenue } from '@/lib/analytics';
import { formatPrice } from '@/lib/utils';
import PageHeader from '@/components/admin/ui/PageHeader';
import StatCard from '@/components/admin/ui/StatCard';
import EmptyState from '@/components/admin/ui/EmptyState';
import { ADMIN_FORM_CSS, DANGER_BG, SANS, sectionCard, sectionTitle, td, th } from '@/components/admin/ui/form-styles';

export const dynamic = 'force-dynamic';

const num: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: SANS };

/** "+12% vs last month", or null when there is nothing to compare against. */
function percentChange(current: number, previous: number): { text: string; positive?: boolean } | null {
  if (previous <= 0) return current > 0 ? { text: 'New this month', positive: true } : null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  return {
    text: `${rounded >= 0 ? '+' : ''}${rounded}% vs last month`,
    positive: rounded > 0 ? true : rounded < 0 ? false : undefined,
  };
}

function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function RevenueChart({ data }: { data: DailyRevenue[] }) {
  const width = 900;
  const chartHeight = 140;
  const top = 20;
  const left = 70;
  const bottom = 28;
  const height = top + chartHeight + bottom;
  const plotWidth = width - left - 10;
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(slot * 0.62, 2);
  const max = Math.max(...data.map((d) => d.revenue), 0);
  const baseline = top + chartHeight;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Daily revenue for the last 30 days"
    >
      <line x1={left} y1={top} x2={width - 10} y2={top} stroke="#EDE7DA" strokeDasharray="4 4" />
      <line x1={left} y1={top + chartHeight / 2} x2={width - 10} y2={top + chartHeight / 2} stroke="#EDE7DA" strokeDasharray="4 4" />
      <text x={left - 8} y={top + 4} textAnchor="end" fontSize="11" fill="#6F6A62">
        {formatPrice(max)}
      </text>
      <text x={left - 8} y={baseline + 4} textAnchor="end" fontSize="11" fill="#6F6A62">
        {formatPrice(0)}
      </text>
      <line x1={left} y1={baseline} x2={width - 10} y2={baseline} stroke="#E4DACB" />

      {data.map((d, i) => {
        const isZero = d.revenue <= 0 || max <= 0;
        const barHeight = isZero ? 2 : Math.max((d.revenue / max) * chartHeight, 2);
        const x = left + i * slot + (slot - barWidth) / 2;
        return (
          <g key={d.date}>
            <rect x={x} y={baseline - barHeight} width={barWidth} height={barHeight} fill={isZero ? '#E4DACB' : '#0F1623'}>
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

const SUBTITLE = 'Sales, traffic, and customer insights';

export default async function AdminAnalyticsPage() {
  let data: AnalyticsSummary | null = null;
  try {
    data = await getAnalytics();
  } catch (error) {
    console.error('[admin] Failed to load analytics:', error);
  }

  if (!data) {
    return (
      <div style={{ fontFamily: SANS }}>
        <PageHeader title="Analytics" subtitle={SUBTITLE} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {['Total Revenue', 'Orders', 'Conversion Rate', 'Avg Order Value'].map((label) => (
            <StatCard key={label} label={label} value="—" />
          ))}
        </div>
        <div role="alert" style={{ ...sectionCard, borderColor: '#E8C9BE', background: DANGER_BG, padding: 0 }}>
          <EmptyState
            title="Analytics unavailable"
            description="Could not load analytics from the database. Check the Firebase Admin settings in your environment variables."
          />
        </div>
      </div>
    );
  }

  const revenueChange = percentChange(data.revenueThisMonth, data.revenueLastMonth);
  const last30Revenue = data.dailyRevenue.reduce((sum, d) => sum + d.revenue, 0);
  const repeatRate = Math.round(data.repeatCustomerRate * 10) / 10;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{ADMIN_FORM_CSS}</style>
      <PageHeader title="Analytics" subtitle={SUBTITLE} />
      <p style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', margin: '-16px 0 20px' }}>
        Paid orders only (confirmed, processing, shipped, delivered). Updates every 15 minutes or when an order changes.
      </p>

      {/* Row 1 — summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Revenue" value={formatPrice(data.totalRevenue)} subtitle={`All time · ${data.totalOrders} paid orders`} />
        <StatCard
          label="This Month Revenue"
          value={formatPrice(data.revenueThisMonth)}
          change={revenueChange?.text}
          changePositive={revenueChange?.positive}
          subtitle={`Last month: ${formatPrice(data.revenueLastMonth)}`}
        />
        <StatCard label="Orders This Month" value={String(data.ordersThisMonth)} subtitle="Paid orders only" />
        <StatCard label="Avg Order Value" value={formatPrice(Math.round(data.averageOrderValue))} subtitle="All time, paid orders" />
      </div>

      {/* Row 2 — revenue chart */}
      <section style={{ ...sectionCard, marginTop: '24px' }}>
        <div
          style={{
            ...sectionTitle,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h2 style={{ font: 'inherit', margin: 0 }}>Revenue — last 30 days</h2>
          <span style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 400, color: 'var(--admin-text-muted)' }}>
            {formatPrice(last30Revenue)} total
          </span>
        </div>
        <RevenueChart data={data.dailyRevenue} />
      </section>

      {/* Row 3 — top products + top locations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: '16px',
          marginTop: '24px',
          alignItems: 'start',
        }}
      >
        <section style={{ ...sectionCard, padding: 0, overflowX: 'auto' }}>
          <h2 style={{ ...sectionTitle, margin: 0, padding: '20px 20px 12px', borderBottom: 'none' }}>Top products</h2>
          {data.topProducts.length === 0 ? (
            <EmptyState title="No paid orders yet" description="Best-selling products will appear here." />
          ) : (
            <table style={tableStyle}>
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
                  <tr key={product.productId} className="vl-row">
                    <td style={{ ...td, color: 'var(--admin-text-subtle)' }}>{index + 1}</td>
                    <td style={td}>
                      {product.slug ? (
                        <a href={`/product/${product.slug}`} style={{ color: 'var(--admin-text)', textDecoration: 'none', fontWeight: 500 }}>
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
        </section>

        <section style={{ ...sectionCard, padding: 0, overflowX: 'auto' }}>
          <h2 style={{ ...sectionTitle, margin: 0, padding: '20px 20px 12px', borderBottom: 'none' }}>Top locations</h2>
          {data.locationStats.length === 0 ? (
            <EmptyState title="No paid orders yet" description="Cities with the most orders will appear here." />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>City, State</th>
                  <th style={{ ...th, ...num }}>Orders</th>
                  <th style={{ ...th, ...num }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.locationStats.map((location) => (
                  <tr key={`${location.city}::${location.state}`} className="vl-row">
                    <td style={td}>{location.state ? `${location.city}, ${location.state}` : location.city}</td>
                    <td style={{ ...td, ...num }}>{location.orderCount}</td>
                    <td style={{ ...td, ...num }}>{formatPrice(location.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Row 4 — repeat customers */}
      <section style={{ ...sectionCard, marginTop: '24px' }}>
        <h2 style={sectionTitle}>Repeat customers</h2>
        <p style={{ fontSize: '14px', margin: '0 0 12px', color: 'var(--admin-text-muted)' }}>
          <strong style={{ fontSize: '24px', fontWeight: 600, color: 'var(--admin-text)', marginRight: '6px' }}>{repeatRate}%</strong>
          of customers have ordered more than once
        </p>
        <div style={{ background: '#EDE7DA', height: '8px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(Math.max(data.repeatCustomerRate, 0), 100)}%`,
              height: '100%',
              background: 'var(--admin-gold)',
            }}
          />
        </div>
      </section>
    </div>
  );
}
