'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { AdminProduct } from '@/lib/types';

type Tab = 'all' | 'featured' | 'hidden';
type Flag = 'featured' | 'hidden';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'featured', label: 'Featured' },
  { key: 'hidden', label: 'Hidden' },
];

const sectionStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '0',
  overflowX: 'auto',
};

const cellStyle: CSSProperties = {
  padding: '10px 12px',
  borderTop: '1px solid #e5e5e5',
  fontSize: '14px',
  verticalAlign: 'middle',
};

const headCellStyle: CSSProperties = {
  padding: '12px',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

function badge(source: AdminProduct['source']): CSSProperties {
  return {
    display: 'inline-block',
    background: source === 'manual' ? '#E3ECF5' : '#F6F1E8',
    color: source === 'manual' ? '#244A6B' : '#6F6A62',
    border: '1px solid #e5e5e5',
    borderRadius: '999px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 500,
  };
}

function toggleStyle(on: boolean, disabled: boolean): CSSProperties {
  return {
    background: on ? '#1C2230' : '#fff',
    color: on ? '#F6F1E8' : '#1C2230',
    border: '1px solid #1C2230',
    borderRadius: '999px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 500,
    minWidth: '52px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;

export default function ProductsTable({ products }: { products: AdminProduct[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const [rows, setRows] = useState<AdminProduct[]>(products);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (tab === 'featured') return rows.filter((p) => p.featured);
    if (tab === 'hidden') return rows.filter((p) => p.hidden);
    return rows;
  }, [rows, tab]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      featured: rows.filter((p) => p.featured).length,
      hidden: rows.filter((p) => p.hidden).length,
    }),
    [rows],
  );

  const toggle = async (product: AdminProduct, flag: Flag) => {
    const next = !product[flag];
    setBusyId(product.id);
    setError(null);
    try {
      const body =
        product.source === 'manual'
          ? { type: 'manual', slug: product.slug, [flag]: next }
          : { type: 'override', productId: product.id, [flag]: next };
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      setRows((current) => current.map((p) => (p.id === product.id ? { ...p, [flag]: next } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div role="tablist" style={{ display: 'flex', gap: '8px', margin: '0 0 16px', flexWrap: 'wrap' }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              style={{
                background: active ? '#1C2230' : '#fff',
                color: active ? '#F6F1E8' : '#1C2230',
                border: '1px solid #ccc',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {label} ({counts[key]})
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}

      <section style={sectionStyle}>
        {visible.length === 0 ? (
          <p style={{ margin: 0, padding: '24px', color: '#6F6A62', fontSize: '14px' }}>No products here.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headCellStyle} aria-label="Image" />
                <th style={headCellStyle}>Name</th>
                <th style={headCellStyle}>Price</th>
                <th style={headCellStyle}>Source</th>
                <th style={headCellStyle}>Featured</th>
                <th style={headCellStyle}>Hidden</th>
                <th style={headCellStyle} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const busy = busyId === product.id;
                const priceChanged = product.original && product.original.price !== product.price;
                return (
                  <tr key={product.id} style={{ opacity: product.hidden ? 0.6 : 1 }}>
                    <td style={{ ...cellStyle, width: '40px' }}>
                      {product.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt=""
                          width={40}
                          height={40}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#eee' }} />
                      )}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 600 }}>{product.name}</div>
                      <div style={{ fontSize: '12px', color: '#6F6A62' }}>{product.slug}</div>
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {formatPrice(product.price)}
                      {priceChanged && product.original ? (
                        <div style={{ fontSize: '12px', color: '#6F6A62', textDecoration: 'line-through' }}>
                          {formatPrice(product.original.price)}
                        </div>
                      ) : null}
                    </td>
                    <td style={cellStyle}>
                      <span style={badge(product.source)}>{product.source === 'manual' ? 'Manual' : 'Sheet'}</span>
                    </td>
                    <td style={cellStyle}>
                      <button
                        type="button"
                        onClick={() => void toggle(product, 'featured')}
                        disabled={busy}
                        aria-pressed={product.featured}
                        aria-label={`Featured: ${product.name}`}
                        style={toggleStyle(product.featured, busy)}
                      >
                        {product.featured ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={cellStyle}>
                      <button
                        type="button"
                        onClick={() => void toggle(product, 'hidden')}
                        disabled={busy}
                        aria-pressed={product.hidden}
                        aria-label={`Hidden: ${product.name}`}
                        style={toggleStyle(product.hidden, busy)}
                      >
                        {product.hidden ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <a
                        href={`/admin/products/${encodeURIComponent(product.id)}`}
                        style={{
                          display: 'inline-block',
                          color: '#1C2230',
                          border: '1px solid #ccc',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
