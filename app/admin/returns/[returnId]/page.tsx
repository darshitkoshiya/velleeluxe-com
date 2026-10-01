'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ReturnStatusPill } from '@/components/admin/ReturnStatusPill';
import {
  decisionsFor,
  effectiveDecision,
  RETURN_DECISION_LABELS,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  RETURN_STATUSES,
  RETURN_TYPE_LABELS,
} from '@/lib/returns-shared';
import type { Order, ReturnDecision, ReturnRequest, ReturnStatus } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface DetailResponse {
  return?: ReturnRequest;
  order?: Order | null;
  error?: string;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '20px',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
  margin: '0 0 12px',
  fontWeight: 600,
};
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', padding: '4px 0' };
const muted: React.CSSProperties = { color: '#6F6A62' };
const primaryButton: React.CSSProperties = {
  background: '#1C2230',
  color: '#F6F1E8',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const accentButton: React.CSSProperties = { ...primaryButton, background: '#C8623D' };
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxSizing: 'border-box',
  marginTop: '6px',
  background: '#fff',
  fontFamily: 'inherit',
};
const label: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '14px' };

const VERDICT_STYLES: Record<'approved' | 'rejected' | 'review', { bg: string; fg: string; text: string }> = {
  approved: { bg: '#D6EFD8', fg: '#185C24', text: 'Auto-approved' },
  rejected: { bg: '#F5E1DA', fg: '#9A3B1E', text: 'Auto-rejected' },
  review: { bg: '#FFF4D6', fg: '#8A6100', text: 'Needs manual review' },
};

function Row({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div style={row}>
      <span style={muted}>{name}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

export default function AdminReturnDetailPage() {
  const params = useParams<{ returnId: string }>();
  const returnId = decodeURIComponent(params?.returnId ?? '');

  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [status, setStatus] = useState<ReturnStatus>('requested');
  const [decision, setDecision] = useState<ReturnDecision | ''>('');
  const [note, setNote] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [tpin, setTpin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyLoaded = useCallback((data: ReturnRequest) => {
    setRequest(data);
    setStatus(data.status);
    setDecision(effectiveDecision(data) ?? '');
    setNote(data.resolutionNote ?? '');
    setCreditAmount(String(data.storeCreditAmount ?? data.itemPrice ?? ''));
    setTpin('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(returnId)}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as DetailResponse;
      if (!response.ok || !data.return) throw new Error(data.error || 'Could not load this return.');
      applyLoaded(data.return);
      setOrder(data.order ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this return.');
    } finally {
      setLoading(false);
    }
  }, [returnId, applyLoaded]);

  useEffect(() => {
    if (returnId) void load();
  }, [returnId, load]);

  if (loading) return <p style={muted}>Loading return…</p>;

  if (loadError || !request) {
    return (
      <div>
        <a href="/admin/returns" style={{ ...muted, fontSize: '13px', textDecoration: 'none' }}>
          ← All returns
        </a>
        <p role="alert" style={{ background: '#F5E1DA', color: '#9A3B1E', padding: '12px 16px', borderRadius: '6px', fontSize: '14px', marginTop: '16px' }}>
          {loadError || 'Return not found.'}
        </p>
      </div>
    );
  }

  const resolved = request.status === 'resolved';
  const isDamage = request.type === 'damage_defect';
  const isCod = request.paymentMethod === 'cod';
  const decisionOptions = decisionsFor(request.paymentMethod);
  const creditIssued = Boolean(request.storeCreditIssuedAt);
  const resolvesToCredit = status === 'resolved' && decision === 'store_credit' && !creditIssued;
  const choosesCredit = isDamage && decision === 'store_credit' && request.adminDecision !== 'store_credit';
  const needsTpin = resolvesToCredit || choosesCredit;
  const canIssueCredit = decision === 'store_credit' && !creditIssued && !resolved;
  const canRefund = isDamage && !isCod && decision === 'razorpay_refund' && !request.razorpayRefundId && !resolved;
  const address = order?.shippingAddress;
  const verification = request.verification;

  const save = async (overrides: { status?: ReturnStatus } = {}) => {
    const nextStatus = overrides.status ?? status;
    const nextDecision = isDamage ? decision || undefined : undefined;
    const willIssueCredit = nextStatus === 'resolved' && (isDamage ? nextDecision : effectiveDecision(request)) === 'store_credit' && !creditIssued;
    const tpinNeeded = willIssueCredit || (isDamage && nextDecision === 'store_credit' && request.adminDecision !== 'store_credit');

    if (tpinNeeded && !tpin.trim()) {
      setError('Enter your TPIN to confirm the store credit.');
      return;
    }
    if (nextStatus === 'resolved' && request.status !== 'resolved') {
      const outcome = (isDamage ? nextDecision : effectiveDecision(request)) ?? null;
      const summary =
        outcome === 'razorpay_refund'
          ? `refund ${formatPrice(request.itemPrice)} to the customer's original payment through Razorpay`
          : outcome === 'store_credit'
            ? `add ${formatPrice(Number(creditAmount) || request.itemPrice)} store credit`
            : outcome
              ? RETURN_DECISION_LABELS[outcome].toLowerCase()
              : 'resolve without a decision';
      if (!window.confirm(`Resolve ${request.returnId} and ${summary}? This is final.`)) return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(request.returnId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          adminDecision: nextDecision,
          resolutionNote: note,
          storeCreditAmount: decision === 'store_credit' && creditAmount ? Number(creditAmount) : undefined,
          tpin: tpinNeeded ? tpin : undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as DetailResponse;
      if (!response.ok || !data.return) throw new Error(data.error || 'Could not update this return.');
      const updated = data.return;
      applyLoaded(updated);
      setNotice(
        updated.razorpayRefundId && !request.razorpayRefundId
          ? `Refund of ${formatPrice(updated.refundAmount ?? 0)} sent to Razorpay (${updated.razorpayRefundId}).`
          : updated.storeCreditIssuedAt && !request.storeCreditIssuedAt
            ? `Saved. ${formatPrice(updated.storeCreditAmount ?? 0)} store credit added to the customer's account.`
            : 'Saved.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setTpin('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <a href="/admin/returns" style={{ ...muted, fontSize: '13px', textDecoration: 'none' }}>
        ← All returns
      </a>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '12px 0 24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, fontFamily: 'ui-monospace, monospace' }}>{request.returnId}</h1>
          <p style={{ ...muted, fontSize: '14px', margin: '6px 0 0' }}>
            {RETURN_TYPE_LABELS[request.type]} · {RETURN_REASON_LABELS[request.reason] ?? '—'} · Requested{' '}
            {formatDateTime(request.createdAt)} · Order <span style={{ fontFamily: 'ui-monospace, monospace' }}>{request.orderId}</span>
          </p>
        </div>
        <ReturnStatusPill status={request.status} />
      </div>

      {notice ? (
        <div role="status" style={{ background: '#E0F2E9', color: '#1E6B45', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {notice}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* Item */}
        <section style={card}>
          <h2 style={sectionTitle}>Item</h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            {request.itemImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin panel, Drive-hosted image
              <img
                src={request.itemImage}
                alt={request.itemProductName}
                style={{ width: '96px', height: '128px', objectFit: 'cover', borderRadius: '4px', background: '#E4DACB', flexShrink: 0 }}
              />
            ) : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px' }}>{request.itemProductName}</p>
              <Row name="Size received" value={request.itemSize} />
              {request.requestedSize ? <Row name="Size requested" value={<strong>{request.requestedSize}</strong>} /> : null}
              <Row name="Price paid" value={formatPrice(request.itemPrice || 0)} />
              <Row name="Payment" value={isCod ? 'Cash on Delivery' : 'Paid online (Razorpay)'} />
            </div>
          </div>
          {request.description ? (
            <div style={{ marginTop: '16px', fontSize: '14px' }}>
              <p style={{ ...sectionTitle, marginBottom: '6px' }}>Customer note</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{request.description}</p>
            </div>
          ) : null}
        </section>

        {/* Customer */}
        <section style={card}>
          <h2 style={sectionTitle}>Customer</h2>
          <Row name="Name" value={request.customerName || '—'} />
          <Row name="Email" value={request.customerEmail || '—'} />
          <Row name="Phone" value={order?.customerPhone ? `+91 ${order.customerPhone}` : '—'} />
          {address ? (
            <div style={{ marginTop: '12px', fontSize: '14px' }}>
              <p style={{ ...sectionTitle, marginBottom: '6px' }}>Pickup address</p>
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                {address.name}
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.city}, {address.state} {address.pincode}
              </p>
            </div>
          ) : null}
          <a
            href={`/admin/store-credit?uid=${encodeURIComponent(request.customerId)}&orderId=${encodeURIComponent(request.orderId)}`}
            style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: '#1C2230' }}
          >
            View / adjust this customer&apos;s store credit →
          </a>
        </section>
      </div>

      {/* Photos + automatic check */}
      {isDamage ? (
        <section style={{ ...card, marginTop: '16px' }}>
          <h2 style={sectionTitle}>Photos ({request.damagePhotos?.length ?? 0}) and automatic check</h2>
          {verification ? (
            <div
              style={{
                background: VERDICT_STYLES[verification.verdict].bg,
                color: VERDICT_STYLES[verification.verdict].fg,
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '14px',
              }}
            >
              <strong>{VERDICT_STYLES[verification.verdict].text}</strong>
              {verification.reason ? ` — ${verification.reason}` : ''}
              <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.85 }}>
                Match: {verification.match ?? '—'}
                {verification.matchedOrderId ? ` (order ${verification.matchedOrderId})` : ''} · Shows damage:{' '}
                {verification.showsDamageOrDefect === undefined ? '—' : verification.showsDamageOrDefect ? 'yes' : 'no'} · Confidence:{' '}
                {typeof verification.confidence === 'number' ? `${Math.round(verification.confidence * 100)}%` : '—'}
                {verification.model ? ` · ${verification.model}` : ''} · {formatDateTime(verification.checkedAt)}
              </div>
            </div>
          ) : null}
          {request.damagePhotos && request.damagePhotos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {request.damagePhotos.map((photo, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URLs
                <img
                  key={index}
                  src={photo}
                  alt={`Customer photo ${index + 1}`}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e5e5', cursor: 'zoom-in' }}
                  onClick={() => {
                    const viewer = window.open('', '_blank');
                    if (viewer) {
                      viewer.document.title = `${request.returnId} photo ${index + 1}`;
                      const img = viewer.document.createElement('img');
                      img.src = photo;
                      img.style.maxWidth = '100%';
                      viewer.document.body.appendChild(img);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <p style={{ ...muted, fontSize: '14px', margin: 0 }}>No photos were uploaded.</p>
          )}
        </section>
      ) : null}

      {/* Actions */}
      <section style={{ ...card, marginTop: '16px' }}>
        <h2 style={sectionTitle}>Manage request</h2>

        {resolved ? (
          <div style={{ background: '#D6EFD8', color: '#185C24', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            Resolved {formatDateTime(request.resolvedAt)} as{' '}
            <strong>{request.adminDecision ? RETURN_DECISION_LABELS[request.adminDecision] : '—'}</strong>.
            {request.storeCreditIssuedAt
              ? ` ${formatPrice(request.storeCreditAmount ?? 0)} store credit issued ${formatDateTime(request.storeCreditIssuedAt)}.`
              : ''}
            {request.razorpayRefundId
              ? ` ${formatPrice(request.refundAmount ?? 0)} refunded via Razorpay (${request.razorpayRefundId}) ${formatDateTime(request.refundedAt)}.`
              : ''}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 16px' }}>
          <label style={label}>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ReturnStatus)} style={input} disabled={resolved}>
              {RETURN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {RETURN_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {isDamage ? (
            <label style={label}>
              Decision
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value as ReturnDecision | '')}
                style={input}
                disabled={resolved}
              >
                <option value="">Not decided yet</option>
                {decisionOptions.map((value) => (
                  <option key={value} value={value}>
                    {RETURN_DECISION_LABELS[value]}
                  </option>
                ))}
              </select>
              {isCod ? (
                <span style={{ ...muted, display: 'block', fontSize: '12px', fontWeight: 400, marginTop: '4px' }}>
                  COD order: exchange or store credit only.
                </span>
              ) : null}
            </label>
          ) : (
            <div style={{ ...label, fontWeight: 400 }}>
              <span style={{ fontWeight: 500 }}>Outcome</span>
              <p style={{ ...muted, margin: '14px 0 0' }}>
                {request.type === 'size_exchange'
                  ? `Automatic: exchange to size ${request.requestedSize ?? '—'}`
                  : 'Automatic: store credit (size unavailable)'}
              </p>
            </div>
          )}

          {decision === 'store_credit' ? (
            <label style={label}>
              Store credit amount (₹)
              <input
                type="number"
                min={1}
                step="1"
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
                style={input}
                disabled={creditIssued}
              />
            </label>
          ) : null}

          {needsTpin || canIssueCredit ? (
            <label style={label}>
              TPIN <span style={{ ...muted, fontWeight: 400 }}>(required for store credit)</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={tpin}
                onChange={(event) => setTpin(event.target.value)}
                style={input}
              />
            </label>
          ) : null}
        </div>

        <label style={label}>
          Resolution note <span style={{ ...muted, fontWeight: 400 }}>(shown to the customer)</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
        </label>

        {error ? (
          <p role="alert" style={{ color: '#9A3B1E', fontSize: '14px', margin: '0 0 16px' }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }} onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Update Status'}
          </button>
          {canIssueCredit ? (
            <button
              type="button"
              style={{ ...accentButton, opacity: saving ? 0.6 : 1 }}
              onClick={() => void save({ status: 'resolved' })}
              disabled={saving}
            >
              Issue Store Credit {creditAmount ? `(${formatPrice(Number(creditAmount) || 0)})` : ''}
            </button>
          ) : null}
          {canRefund ? (
            <button
              type="button"
              style={{ ...accentButton, opacity: saving ? 0.6 : 1 }}
              onClick={() => void save({ status: 'resolved' })}
              disabled={saving}
            >
              Refund {formatPrice(request.itemPrice)} via Razorpay
            </button>
          ) : null}
        </div>
        {canIssueCredit ? (
          <p style={{ ...muted, fontSize: '13px', margin: '10px 0 0' }}>
            Issuing store credit resolves the request and adds the amount to the customer&apos;s balance. Do this after inspection.
          </p>
        ) : null}
        {canRefund ? (
          <p style={{ ...muted, fontSize: '13px', margin: '10px 0 0' }}>
            Sends a refund for this item&apos;s price to the original payment through the Razorpay API and resolves the request. Use only in rare cases.
          </p>
        ) : null}
      </section>
    </div>
  );
}
