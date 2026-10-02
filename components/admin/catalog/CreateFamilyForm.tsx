'use client';

/** Inline "new family" form for /admin/catalog/families. POSTs then refreshes the server page. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errMsg, readJson } from '@/components/admin/catalog-ui';
import { DANGER, MONO, OK, btn, fieldInput } from '@/components/admin/ui/admin-styles';

export default function CreateFamilyForm() {
  const router = useRouter();
  const [familySku, setFamilySku] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const create = async () => {
    if (!familySku.trim()) return setMsg({ kind: 'error', text: 'Enter a family SKU.' });
    setBusy(true);
    setMsg(null);
    try {
      const response = await fetch('/api/admin/catalog/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familySku: familySku.trim() }),
      });
      const data = await readJson<{ family?: { familySku: string } }>(response);
      if (!response.ok || !data.family) throw new Error(data.error || 'Could not create family.');
      setMsg({ kind: 'ok', text: `Created ${data.family.familySku}.` });
      setFamilySku('');
      router.refresh();
    } catch (err) {
      setMsg({ kind: 'error', text: errMsg(err, 'Could not create family.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
    >
      <label htmlFor="new-family-sku" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        New family SKU
      </label>
      <input
        id="new-family-sku"
        value={familySku}
        placeholder="New family SKU, e.g. VL-DRESS-001"
        disabled={busy}
        onChange={(e) => setFamilySku(e.target.value)}
        style={{ ...fieldInput, width: '260px', fontFamily: MONO, fontSize: '13px' }}
      />
      <button type="submit" disabled={busy} style={btn('primary', { disabled: busy })}>
        {busy ? 'Creating…' : '+ New Family'}
      </button>
      {msg ? (
        <span role={msg.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '12px', color: msg.kind === 'error' ? DANGER : OK, flexBasis: '100%' }}>
          {msg.text}
        </span>
      ) : null}
    </form>
  );
}
