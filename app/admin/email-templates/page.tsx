'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import PageHeader from '@/components/admin/ui/PageHeader';
import {
  ADMIN_FORM_CSS,
  AMBER,
  CREAM,
  DANGER,
  INK,
  SANS,
  SERIF,
  button,
  fieldLabel,
  flash,
  hint,
  infoBox,
  input,
  sectionCard,
  sectionTitle,
  switchKnob,
  switchTrack,
} from '@/components/admin/ui/form-styles';

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

  const saveDisabled = saving || !current || !unsaved || subjectError !== null;
  const resetDisabled = saving || !current || matchesDefault;

  const templateCard = (selected: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    textAlign: 'left',
    padding: '16px',
    background: selected ? '#FDFAF6' : 'var(--admin-surface)',
    border: `1px solid ${selected ? INK : 'var(--admin-border)'}`,
    boxShadow: selected ? `inset 0 0 0 1px ${INK}` : 'none',
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: SANS,
    color: 'var(--admin-text)',
  });

  return (
    <div style={{ maxWidth: '1100px', fontFamily: SANS }}>
      <style>{ADMIN_FORM_CSS}</style>
      <PageHeader title="Email Templates" subtitle="Manage transactional email content" />

      <p role="note" style={{ ...infoBox, margin: '0 0 20px', color: 'var(--admin-text-muted)' }}>
        Transactional emails are sent via your email provider. Change the wording here — order details, address and tracking
        sections are filled in automatically.
      </p>

      {/* Template picker */}
      <div
        role="tablist"
        aria-label="Email templates"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}
      >
        {TABS.map((t) => {
          const selected = t.key === active;
          const dirty = unsavedFor(t.key);
          const customised = Boolean(saved && defaults && snapshot(saved[t.key]) !== snapshot(defaults[t.key]));
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="template-editor"
              onClick={() => {
                setActive(t.key);
                setMessage(null);
                setError(null);
              }}
              style={templateCard(selected)}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                <span style={{ fontFamily: SERIF, fontSize: '15px', fontWeight: 600 }}>{t.label}</span>
                {dirty ? (
                  <span title="Unsaved changes" style={{ fontSize: '11px', fontWeight: 500, color: AMBER }}>
                    ● Unsaved
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--admin-text-muted)' }}>{t.description}</span>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-subtle)', marginTop: '4px' }}>
                {loading ? '…' : customised ? 'Customised' : 'Default wording'}
              </span>
            </button>
          );
        })}
      </div>

      <div id="template-editor" role="tabpanel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Editor */}
        <section style={sectionCard}>
          {loading ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading…</p>
          ) : !current ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>Templates are unavailable.</p>
          ) : (
            <>
              <h2 style={sectionTitle}>{tab.label}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label htmlFor="template-subject" style={fieldLabel}>
                    Subject line
                  </label>
                  <input
                    id="template-subject"
                    className="vl-input"
                    type="text"
                    value={current.subject}
                    maxLength={MAX_SUBJECT_LENGTH}
                    aria-invalid={subjectError !== null}
                    disabled={saving}
                    onChange={(event) => update({ subject: event.target.value })}
                    style={input(subjectError !== null)}
                  />
                  <p style={{ ...hint, color: subjectError ? DANGER : hint.color }}>
                    {subjectError ?? 'Use {orderId} as a placeholder — it is replaced with the real order number.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="template-header" style={fieldLabel}>
                    Header text
                  </label>
                  <textarea
                    id="template-header"
                    className="vl-input"
                    value={current.headerText}
                    maxLength={MAX_BODY_TEXT_LENGTH}
                    rows={2}
                    disabled={saving}
                    onChange={(event) => update({ headerText: event.target.value })}
                    style={{ ...input(), resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <p style={hint}>The large heading at the top of the email. Leave empty to hide it.</p>
                </div>

                <div>
                  <label htmlFor="template-footer" style={fieldLabel}>
                    Footer text
                  </label>
                  <textarea
                    id="template-footer"
                    className="vl-input"
                    value={current.footerText}
                    maxLength={MAX_BODY_TEXT_LENGTH}
                    rows={3}
                    disabled={saving}
                    onChange={(event) => update({ footerText: event.target.value })}
                    style={{ ...input(), resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <p style={hint}>The closing message near the end of the email. Leave empty to hide it.</p>
                </div>

                {tab.toggles.map((toggle) => {
                  const on = current[toggle.field] ?? true;
                  const id = `toggle-${toggle.field}`;
                  return (
                    <div
                      key={toggle.field}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '24px',
                        paddingTop: '14px',
                        borderTop: '1px solid var(--admin-border-light)',
                      }}
                    >
                      <div>
                        <span id={`${id}-label`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, margin: '0 0 2px' }}>
                          {toggle.label}
                        </span>
                        <span id={`${id}-hint`} style={{ display: 'block', ...hint, margin: 0 }}>
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
                        style={switchTrack(on, saving)}
                      >
                        <span aria-hidden="true" style={switchKnob(on)} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--admin-border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button type="button" onClick={() => void save()} disabled={saveDisabled} style={button('primary', saveDisabled)}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={resetToDefault} disabled={resetDisabled} style={button('secondary', resetDisabled)}>
                  Reset to Default
                </button>
                {unsaved ? <span style={{ fontSize: '12px', color: AMBER }}>You have unsaved changes.</span> : null}
              </div>
            </>
          )}

          {message ? (
            <p role="status" style={flash('ok')}>
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" style={flash('error')}>
              {error}
            </p>
          ) : null}
        </section>

        {/* Preview */}
        {current ? (
          <section style={sectionCard} aria-label="Email preview">
            <h2 style={sectionTitle}>Preview</h2>
            <div style={{ background: CREAM, border: '1px solid var(--admin-border)', padding: '20px', color: 'var(--admin-text)' }}>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                <strong style={{ color: 'var(--admin-text)', fontWeight: 600 }}>Subject:</strong> {fill(current.subject) || '(empty)'}
              </p>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--admin-border-light)', padding: '24px' }}>
                <p style={{ margin: '0 0 18px', textAlign: 'center', fontSize: '12px', fontWeight: 500, letterSpacing: '0.3em' }}>
                  VELLEE LUXE
                </p>
                {current.headerText.trim() ? (
                  <p style={{ margin: '0 0 12px', fontFamily: SERIF, fontSize: '20px', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                    {fill(current.headerText)}
                  </p>
                ) : null}
                <div
                  style={{
                    margin: '0 0 12px',
                    padding: '14px',
                    border: '1px dashed var(--admin-border)',
                    fontSize: '12px',
                    color: 'var(--admin-text-muted)',
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
                  <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', color: 'var(--admin-text-muted)', whiteSpace: 'pre-wrap' }}>
                    {fill(current.footerText)}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
