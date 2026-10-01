'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/** Mirrors the types in lib/email-templates.ts (that file is server-only). */
type TemplateKey = 'orderConfirmation' | 'orderShipped' | 'returnConfirmed' | 'passwordReset';
type BooleanField = 'showOrderSummary' | 'showShippingAddress' | 'showTrackingInfo';
interface EmailTemplate {
  subject: string;
  headerText: string;
  footerText: string;
  showOrderSummary?: boolean;
  showShippingAddress?: boolean;
  showTrackingInfo?: boolean;
}
type EmailTemplates = Record<TemplateKey, EmailTemplate>;

type TemplatesResponse = { templates?: EmailTemplates; defaults?: EmailTemplates; error?: string };

/** Must match MAX_SUBJECT_LENGTH / MAX_BODY_TEXT_LENGTH in lib/email-templates.ts (the API enforces them). */
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_TEXT_LENGTH = 1000;

const TABS: { key: TemplateKey; label: string; description: string; toggles: { field: BooleanField; label: string; hint: string }[] }[] = [
  {
    key: 'orderConfirmation',
    label: 'Order Confirmation',
    description: 'Sent to the customer as soon as an order is placed.',
    toggles: [
      { field: 'showOrderSummary', label: 'Show order summary', hint: 'The list of items with subtotal, shipping and total.' },
      { field: 'showShippingAddress', label: 'Show shipping address', hint: 'The address the order will be delivered to.' },
    ],
  },
  {
    key: 'orderShipped',
    label: 'Order Shipped',
    description: 'Sent when you mark an order as shipped.',
    toggles: [{ field: 'showTrackingInfo', label: 'Show tracking info', hint: 'Courier name, tracking number and the "Track your parcel" button.' }],
  },
  {
    key: 'returnConfirmed',
    label: 'Return Confirmed',
    description: 'Sent to the customer to confirm their return.',
    toggles: [],
  },
  {
    key: 'passwordReset',
    label: 'Password Reset',
    description: 'Sent when you send a password reset link from the Customers page.',
    toggles: [],
  },
];

const SAMPLE_ORDER_ID = 'VL-240501-ABCD';

function snapshot(template: EmailTemplate | undefined): string {
  if (!template) return '';
  return JSON.stringify([
    template.subject.trim(),
    template.headerText.trim(),
    template.footerText.trim(),
    template.showOrderSummary ?? null,
    template.showShippingAddress ?? null,
    template.showTrackingInfo ?? null,
  ]);
}

function fill(text: string): string {
  return text.replace(/\{orderId\}/g, SAMPLE_ORDER_ID);
}

export default function AdminEmailTemplatesPage() {
  const [active, setActive] = useState<TemplateKey>('orderConfirmation');
  /** What is saved in the database right now. */
  const [saved, setSaved] = useState<EmailTemplates | null>(null);
  /** Built-in wording (for Reset to Default). */
  const [defaults, setDefaults] = useState<EmailTemplates | null>(null);
  /** What the form currently shows (may be unsaved). */
  const [draft, setDraft] = useState<EmailTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyResponse = (data: TemplatesResponse, keepOtherDrafts: boolean, savedKey?: TemplateKey) => {
    if (!data.templates || !data.defaults) throw new Error(data.error || 'Unexpected response.');
    const templates = data.templates;
    setSaved(templates);
    setDefaults(data.defaults);
    setDraft((current) => {
      if (!keepOtherDrafts || !current || !savedKey) return templates;
      return { ...current, [savedKey]: templates[savedKey] };
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/email-templates', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as TemplatesResponse;
        if (!response.ok) throw new Error(data.error || 'Could not load email templates.');
        if (!cancelled) applyResponse(data, false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load email templates.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  const current = draft?.[active];
  const unsavedFor = (key: TemplateKey) => Boolean(saved && draft && snapshot(saved[key]) !== snapshot(draft[key]));
  const unsaved = unsavedFor(active);
  const matchesDefault = Boolean(defaults && current && snapshot(defaults[active]) === snapshot(current));

  const subjectError = current
    ? !current.subject.trim()
      ? 'Subject line cannot be empty.'
      : current.subject.trim().length > MAX_SUBJECT_LENGTH
        ? `Keep the subject under ${MAX_SUBJECT_LENGTH} characters.`
        : null
    : null;

  const update = (patch: Partial<EmailTemplate>) => {
    setDraft((d) => (d ? { ...d, [active]: { ...d[active], ...patch } } : d));
    setMessage(null);
    setError(null);
  };

  const save = async () => {
    if (!current) return;
    if (subjectError) {
      setError(subjectError);
      return;
    }
    const updates: Record<string, string | boolean> = {
      subject: current.subject.trim(),
      headerText: current.headerText.trim(),
      footerText: current.footerText.trim(),
    };
    for (const toggle of tab.toggles) {
      updates[toggle.field] = current[toggle.field] ?? true;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: active, updates }),
      });
      const data = (await response.json().catch(() => ({}))) as TemplatesResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save the template.');
      applyResponse(data, true, active);
      setMessage(`Saved. The next ${tab.label} email will use this wording.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the template.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (!defaults) return;
    setDraft((d) => (d ? { ...d, [active]: { ...defaults[active] } } : d));
    setError(null);
    setMessage('Default wording restored. Click Save to apply it.');
  };

  const fieldStyle = (invalid: boolean): CSSProperties => ({
    padding: '10px 12px',
    fontSize: '15px',
    border: `1px solid ${invalid ? '#9A3B1E' : '#ccc'}`,
    borderRadius: '6px',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  });
  const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' };
  const hintStyle: CSSProperties = { fontSize: '12px', color: '#6F6A62', margin: '4px 0 0' };
  const sectionHeadingStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    margin: '0 0 16px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6F6A62',
  };
  const saveDisabled = saving || !current || !unsaved || subjectError !== null;
  const resetDisabled = saving || !current || matchesDefault;

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px' }}>Email Templates</h1>
      <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 24px', lineHeight: 1.5 }}>
        Change the wording of the emails customers receive. The order details, address and tracking sections are filled in
        automatically.
      </p>

      <div role="tablist" aria-label="Email templates" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {TABS.map((t) => {
          const selected = t.key === active;
          const dirty = unsavedFor(t.key);
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActive(t.key);
                setMessage(null);
                setError(null);
              }}
              style={{
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                border: `1px solid ${selected ? '#1C2230' : '#ccc'}`,
                background: selected ? '#1C2230' : '#fff',
                color: selected ? '#F6F1E8' : '#1C2230',
                cursor: 'pointer',
              }}
            >
              {t.label}
              {dirty ? <span style={{ color: selected ? '#E8C468' : '#8A6100' }}> •</span> : null}
            </button>
          );
        })}
      </div>

      <section style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '24px' }}>
        {loading ? (
          <p style={{ margin: 0, color: '#6F6A62' }}>Loading…</p>
        ) : !current ? null : (
          <>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>{tab.label}</h2>
            <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 20px', lineHeight: 1.5 }}>{tab.description}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label htmlFor="template-subject" style={labelStyle}>
                  Subject line
                </label>
                <input
                  id="template-subject"
                  type="text"
                  value={current.subject}
                  maxLength={MAX_SUBJECT_LENGTH}
                  aria-invalid={subjectError !== null}
                  disabled={saving}
                  onChange={(event) => update({ subject: event.target.value })}
                  style={fieldStyle(subjectError !== null)}
                />
                <p style={{ ...hintStyle, color: subjectError ? '#9A3B1E' : '#6F6A62' }}>
                  {subjectError ?? 'Use {orderId} as a placeholder — it is replaced with the real order number.'}
                </p>
              </div>

              <div>
                <label htmlFor="template-header" style={labelStyle}>
                  Header text
                </label>
                <textarea
                  id="template-header"
                  value={current.headerText}
                  maxLength={MAX_BODY_TEXT_LENGTH}
                  rows={2}
                  disabled={saving}
                  onChange={(event) => update({ headerText: event.target.value })}
                  style={{ ...fieldStyle(false), resize: 'vertical', lineHeight: 1.5 }}
                />
                <p style={hintStyle}>The large heading at the top of the email. Leave empty to hide it.</p>
              </div>

              <div>
                <label htmlFor="template-footer" style={labelStyle}>
                  Footer text
                </label>
                <textarea
                  id="template-footer"
                  value={current.footerText}
                  maxLength={MAX_BODY_TEXT_LENGTH}
                  rows={3}
                  disabled={saving}
                  onChange={(event) => update({ footerText: event.target.value })}
                  style={{ ...fieldStyle(false), resize: 'vertical', lineHeight: 1.5 }}
                />
                <p style={hintStyle}>The closing message near the end of the email. Leave empty to hide it.</p>
              </div>

              {tab.toggles.map((toggle) => {
                const on = current[toggle.field] ?? true;
                const id = `toggle-${toggle.field}`;
                return (
                  <div key={toggle.field} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
                    <div>
                      <span id={`${id}-label`} style={{ display: 'block', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                        {toggle.label}
                      </span>
                      <span id={`${id}-hint`} style={{ display: 'block', fontSize: '13px', color: '#6F6A62', lineHeight: 1.5 }}>
                        {toggle.hint}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-labelledby={`${id}-label`}
                      aria-describedby={`${id}-hint`}
                      disabled={saving}
                      onClick={() => update({ [toggle.field]: !on })}
                      style={{
                        flexShrink: 0,
                        position: 'relative',
                        width: '56px',
                        height: '30px',
                        borderRadius: '999px',
                        border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        background: on ? '#1E6B45' : '#bbb',
                        transition: 'background 0.2s',
                        padding: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '3px',
                          left: on ? '29px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e5e5' }}>
              <h3 style={sectionHeadingStyle}>Preview</h3>
              <div style={{ background: '#F6F1E8', border: '1px solid #E4DACB', borderRadius: '6px', padding: '20px', color: '#1C2230' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6F6A62' }}>
                  <strong style={{ color: '#1C2230' }}>Subject:</strong> {fill(current.subject) || '(empty)'}
                </p>
                <div style={{ background: '#fff', borderRadius: '4px', padding: '20px' }}>
                  <p style={{ margin: '0 0 16px', textAlign: 'center', fontSize: '13px', fontWeight: 500, letterSpacing: '0.3em' }}>VELLEE LUXE</p>
                  {current.headerText.trim() ? (
                    <p style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 500, whiteSpace: 'pre-wrap' }}>{fill(current.headerText)}</p>
                  ) : null}
                  <div
                    style={{
                      margin: '0 0 12px',
                      padding: '14px',
                      border: '1px dashed #ccc',
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#6F6A62',
                      lineHeight: 1.6,
                    }}
                  >
                    {active === 'orderConfirmation' ? (
                      <>
                        Order details for {SAMPLE_ORDER_ID}
                        {current.showOrderSummary ?? true ? <><br />+ Order summary (items, subtotal, shipping, total)</> : null}
                        {current.showShippingAddress ?? true ? <><br />+ Shipping address</> : null}
                        <br />+ Payment method
                      </>
                    ) : active === 'orderShipped' ? (
                      <>
                        Shipping details for {SAMPLE_ORDER_ID}
                        {current.showTrackingInfo ?? true ? <><br />+ Tracking info (courier, tracking number)</> : null}
                        <br />+ Items in this parcel
                        <br />+ Delivery address
                      </>
                    ) : active === 'returnConfirmed' ? (
                      <>Return details for order {SAMPLE_ORDER_ID} (return ID and item)</>
                    ) : (
                      <>Reset password button and link</>
                    )}
                  </div>
                  {current.footerText.trim() ? (
                    <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: '#6F6A62', whiteSpace: 'pre-wrap' }}>
                      {fill(current.footerText)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saveDisabled}
                style={{
                  background: '#1C2230',
                  color: '#F6F1E8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: saveDisabled ? 'not-allowed' : 'pointer',
                  opacity: saveDisabled ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={resetToDefault}
                disabled={resetDisabled}
                style={{
                  background: 'transparent',
                  color: '#1C2230',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '11px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: resetDisabled ? 'not-allowed' : 'pointer',
                  opacity: resetDisabled ? 0.5 : 1,
                }}
              >
                Reset to Default
              </button>
              {unsaved ? <span style={{ fontSize: '13px', color: '#8A6100' }}>You have unsaved changes.</span> : null}
            </div>
          </>
        )}

        {message ? (
          <p role="status" style={{ margin: '16px 0 0', fontSize: '14px', color: '#1E6B45' }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: '16px 0 0', fontSize: '14px', color: '#9A3B1E' }}>
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
