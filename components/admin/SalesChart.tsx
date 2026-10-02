'use client';
/**
 * SalesChart — daily revenue (gold bars) and order count (navy line) for the admin dashboard.
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DayData {
  date: string; // "Apr 18"
  revenue: number;
  orders: number;
}

interface SalesChartProps {
  data: DayData[];
  period: '7d' | '30d';
}

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
const SERIF = 'var(--font-newsreader), Georgia, serif';
const GOLD = '#C9A96E';
const NAVY = '#2F5577';

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = Number(payload.find((p) => p.dataKey === 'revenue')?.value ?? 0);
  const orders = Number(payload.find((p) => p.dataKey === 'orders')?.value ?? 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--admin-border)',
        padding: '10px 12px',
        fontFamily: SANS,
        fontSize: 12,
        color: 'var(--admin-text)',
        minWidth: 140,
      }}
    >
      <p style={{ margin: '0 0 6px', color: 'var(--admin-text-muted)', fontSize: 11 }}>{label}</p>
      <p style={{ margin: '0 0 2px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, background: GOLD, opacity: 0.7, display: 'inline-block' }} />
          Revenue
        </span>
        <strong style={{ fontWeight: 600 }}>₹{revenue.toLocaleString('en-IN')}</strong>
      </p>
      <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 2, background: NAVY, display: 'inline-block' }} />
          Orders
        </span>
        <strong style={{ fontWeight: 600 }}>{orders}</strong>
      </p>
    </div>
  );
}

function LegendItem({ colour, label, line }: { colour: string; label: string; line?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: line ? 14 : 10,
          height: line ? 2 : 10,
          background: colour,
          opacity: line ? 1 : 0.7,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

export default function SalesChart({ data, period }: SalesChartProps) {
  const periodLabel = period === '30d' ? 'Last 30 days' : 'Last 7 days';

  return (
    <div
      style={{
        background: 'var(--admin-surface)',
        border: '1px solid var(--admin-border)',
        padding: 24,
        fontFamily: SANS,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 400, margin: 0, color: 'var(--admin-text)' }}>
            Sales Trend
          </h2>
          <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>
            Total revenue (₹) · {periodLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--admin-text-muted)' }}>
          <LegendItem colour={GOLD} label="Revenue" />
          <LegendItem colour={NAVY} label="Orders" line />
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#F0EBE0" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9E9A94', fontFamily: SANS }}
              dy={6}
            />
            <YAxis yAxisId="revenue" hide />
            <YAxis yAxisId="orders" orientation="right" hide allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201, 169, 110, 0.08)' }} />
            <Bar yAxisId="revenue" dataKey="revenue" fill={GOLD} fillOpacity={0.7} maxBarSize={36} />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              stroke={NAVY}
              strokeWidth={2}
              dot={{ r: 3, fill: NAVY, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
