'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const sectionStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
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

/** Same rules as slugify() in lib/product-overrides.ts (server-only, so duplicated here). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const Required = () => <span style={{ color: '#9A3B1E' }}> *</span>;

export default function AdminNewProductPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [colour, setColour] = useState('');
  const [fabric, setFabric] = useState('');
  const [imagesText, setImagesText] = useState('');
  const [stock, setStock] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugify(name);

  const toggleSize = (size: string) => {
    setSizes((current) => (current.includes(size) ? current.filter((s) => s !== size) : [...current, size]));
  };

  const save = async () => {
    setError(null);
    const priceNumber = Number(price);
    const stockNumber = Number(stock);
    if (!name.trim() || !slug) return setError('Name is required.');
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return setError('Price must be a positive number.');
    if (!Number.isInteger(stockNumber) || stockNumber < 0) return setError('Stock must be a whole number (0 or more).');

    setSaving(true);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual',
          createOnly: true,
          slug,
          name: name.trim(),
          description: description.trim(),
          price: priceNumber,
          sizes: SIZES.filter((size) => sizes.includes(size)),
          colour: colour.trim(),
          fabric: fabric.trim(),
          images: imagesText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          stock: stockNumber,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save product.');
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product.');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '880px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
        <a href="/admin/products" style={{ color: '#6F6A62', textDecoration: 'none' }}>
          ← All products
        </a>
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 24px' }}>Add Product</h1>

      {error ? (
        <p role="alert" style={{ margin: '0 0 16px', fontSize: '14px', color: '#9A3B1E' }}>
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section style={sectionStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="new-name" style={labelStyle}>
                Name
                <Required />
              </label>
              <input
                id="new-name"
                type="text"
                value={name}
                required
                disabled={saving}
                onChange={(event) => setName(event.target.value)}
                style={inputStyle}
              />
              <p style={hintStyle}>URL: /product/{slug || '…'}</p>
            </div>

            <div>
              <label htmlFor="new-description" style={labelStyle}>
                Description
              </label>
              <textarea
                id="new-description"
                value={description}
                rows={5}
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label htmlFor="new-price" style={labelStyle}>
                Price (₹)
                <Required />
              </label>
              <input
                id="new-price"
                type="number"
                min={1}
                step="any"
                value={price}
                required
                disabled={saving}
                onChange={(event) => setPrice(event.target.value)}
                style={inputStyle}
              />
            </div>

            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={labelStyle}>Sizes</legend>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {SIZES.map((size) => (
                  <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px' }}>
                    <input
                      type="checkbox"
                      checked={sizes.includes(size)}
                      disabled={saving}
                      onChange={() => toggleSize(size)}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="new-colour" style={labelStyle}>
                Colour
              </label>
              <input
                id="new-colour"
                type="text"
                value={colour}
                disabled={saving}
                onChange={(event) => setColour(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="new-fabric" style={labelStyle}>
                Fabric
              </label>
              <input
                id="new-fabric"
                type="text"
                value={fabric}
                disabled={saving}
                onChange={(event) => setFabric(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="new-images" style={labelStyle}>
                Image URLs
              </label>
              <textarea
                id="new-images"
                value={imagesText}
                rows={4}
                placeholder="https://…"
                disabled={saving}
                onChange={(event) => setImagesText(event.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <p style={hintStyle}>One URL per line. The first image is the main photo.</p>
            </div>

            <div>
              <label htmlFor="new-stock" style={labelStyle}>
                Stock
              </label>
              <input
                id="new-stock"
                type="number"
                min={0}
                step={1}
                value={stock}
                disabled={saving}
                onChange={(event) => setStock(event.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        <button type="submit" disabled={saving} style={primaryButton(saving)}>
          {saving ? 'Saving…' : 'Save Product'}
        </button>
      </form>
    </div>
  );
}
