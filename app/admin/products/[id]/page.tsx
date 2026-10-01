'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminProduct } from '@/lib/types';

const sectionStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
};

const capsHeading: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };

const hintStyle: CSSProperties = { fontSize: '13px', color: '#6F6A62', margin: '6px 0 0' };

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: '15px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  background: '#fff',
  fontFamily: 'inherit',
  color: '#1C2230',
};

function primaryButton(disabled: boolean): CSSProperties {
  return {
    background: '#1C2230',
    color: '#F6F1E8',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function smallButton(disabled: boolean): CSSProperties {
  return {
    background: 'transparent',
    color: '#1C2230',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

type Form = {
  title: string;
  description: string;
  price: string;
  stock: string;
  colour: string;
  featured: boolean;
  hidden: boolean;
};

function formFromProduct(product: AdminProduct): Form {
  if (product.source === 'manual') {
    return {
      title: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(typeof product.stock === 'number' ? product.stock : 0),
      colour: product.colour,
      featured: product.featured,
      hidden: product.hidden,
    };
  }
  const o = product.override;
  return {
    title: o?.titleOverride ?? '',
    description: o?.descriptionOverride ?? '',
    price: typeof o?.priceOverride === 'number' ? String(o.priceOverride) : '',
    stock: '',
    colour: '',
    featured: product.featured,
    hidden: product.hidden,
  };
}

export default function AdminProductEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(String(params?.id ?? ''));

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch('/api/admin/products', { cache: 'no-store' });
    const data = (await response.json().catch(() => ({}))) as { products?: AdminProduct[]; error?: string };
    if (!response.ok || !Array.isArray(data.products)) throw new Error(data.error || 'Could not load product.');
    const found = data.products.find((p) => p.id === id) ?? null;
    setProduct(found);
    setForm(found ? formFromProduct(found) : null);
    if (!found) setError('Product not found.');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load product.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!product || !form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let body: Record<string, unknown>;
      if (product.source === 'manual') {
        const price = Number(form.price);
        const stock = Number(form.stock);
        if (!form.title.trim()) throw new Error('Name is required.');
        if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number.');
        if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number (0 or more).');
        body = {
          type: 'manual',
          slug: product.slug,
          name: form.title,
          description: form.description,
          price,
          stock,
          colour: form.colour,
          featured: form.featured,
          hidden: form.hidden,
        };
      } else {
        let priceOverride: number | null = null;
        if (form.price.trim()) {
          priceOverride = Number(form.price);
          if (!Number.isFinite(priceOverride) || priceOverride <= 0) {
            throw new Error('Price override must be a positive number.');
          }
        }
        body = {
          type: 'override',
          productId: product.id,
          titleOverride: form.title.trim() || null,
          descriptionOverride: form.description.trim() || null,
          priceOverride,
          featured: form.featured,
          hidden: form.hidden,
        };
      }
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      await load();
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not delete.');
      setConfirmDelete(false);
      if (product.source === 'manual') {
        router.push('/admin/products');
        return;
      }
      await load();
      setMessage('Override removed. The product now uses its sheet values.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setSaving(false);
    }
  };

  const isManual = product?.source === 'manual';
  const hasOverride = Boolean(product?.override);

  const clearButton = (key: 'title' | 'description' | 'price') =>
    !isManual && form && form[key] ? (
      <button type="button" onClick={() => update(key, '')} disabled={saving} style={smallButton(saving)}>
        Clear override
      </button>
    ) : null;

  return (
    <div style={{ maxWidth: '880px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
        <a href="/admin/products" style={{ color: '#6F6A62', textDecoration: 'none' }}>
          ← All products
        </a>
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>
        {product ? product.name : 'Edit Product'}
      </h1>

      {message ? (
        <p role="status" style={{ margin: '0 0 16px', fontSize: '14px', color: '#1E6B45' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: '#6F6A62' }}>Loading…</p>
      ) : product && form ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <section style={sectionStyle}>
            <h2 style={capsHeading}>{isManual ? 'Manual Product' : 'Sheet Product — Overrides'}</h2>
            {!isManual ? (
              <p style={{ ...hintStyle, margin: '0 0 16px' }}>
                Leave a field empty to use the value from the supplier sheet.
              </p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="product-title" style={labelStyle}>
                    {isManual ? 'Name' : 'Title override'}
                  </label>
                  {clearButton('title')}
                </div>
                <input
                  id="product-title"
                  type="text"
                  value={form.title}
                  placeholder={product.original?.name}
                  disabled={saving}
                  onChange={(event) => update('title', event.target.value)}
                  style={inputStyle}
                />
                {!isManual && product.original ? <p style={hintStyle}>Sheet: {product.original.name}</p> : null}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="product-description" style={labelStyle}>
                    {isManual ? 'Description' : 'Description override'}
                  </label>
                  {clearButton('description')}
                </div>
                <textarea
                  id="product-description"
                  value={form.description}
                  rows={5}
                  placeholder={product.original?.description}
                  disabled={saving}
                  onChange={(event) => update('description', event.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="product-price" style={labelStyle}>
                    {isManual ? 'Price (₹)' : 'Price override (₹)'}
                  </label>
                  {clearButton('price')}
                </div>
                <input
                  id="product-price"
                  type="number"
                  min={1}
                  step="any"
                  value={form.price}
                  placeholder={product.original ? String(product.original.price) : undefined}
                  disabled={saving}
                  onChange={(event) => update('price', event.target.value)}
                  style={inputStyle}
                />
                {!isManual && product.original ? <p style={hintStyle}>Sheet: ₹{product.original.price}</p> : null}
              </div>

              {isManual ? (
                <>
                  <div>
                    <label htmlFor="product-stock" style={labelStyle}>
                      Stock
                    </label>
                    <input
                      id="product-stock"
                      type="number"
                      min={0}
                      step={1}
                      value={form.stock}
                      disabled={saving}
                      onChange={(event) => update('stock', event.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="product-colour" style={labelStyle}>
                      Colour
                    </label>
                    <input
                      id="product-colour"
                      type="text"
                      value={form.colour}
                      disabled={saving}
                      onChange={(event) => update('colour', event.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={capsHeading}>Visibility</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px' }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  disabled={saving}
                  onChange={(event) => update('featured', event.target.checked)}
                />
                Featured
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px' }}>
                <input
                  type="checkbox"
                  checked={form.hidden}
                  disabled={saving}
                  onChange={(event) => update('hidden', event.target.checked)}
                />
                Hidden (not shown in the shop and cannot be ordered)
              </label>
            </div>
          </section>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving} style={primaryButton(saving)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {isManual || hasOverride ? (
              confirmDelete ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', color: '#9A3B1E', fontWeight: 600 }}>
                    {isManual ? 'Delete this product?' : 'Remove all overrides?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={saving}
                    style={{ ...smallButton(saving), background: '#9A3B1E', color: '#fff', border: '1px solid #9A3B1E', padding: '11px 16px' }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                    style={{ ...smallButton(saving), padding: '11px 16px' }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                  style={{ ...smallButton(saving), color: '#9A3B1E', padding: '11px 20px', fontSize: '14px' }}
                >
                  {isManual ? 'Delete Product' : 'Delete Override'}
                </button>
              )
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
