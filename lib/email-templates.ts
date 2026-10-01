/**
 * Editable customer email text, stored in Firestore at `config/emailTemplates` (server-only).
 * Changed from the admin panel at /admin/email-templates. Only the wording around the
 * structured sections (order summary, address, tracking) is editable.
 */
import { getAdminDb } from './firebase-admin';

export interface OrderConfirmationTemplate {
  subject: string;
  headerText: string;
  footerText: string;
  showOrderSummary: boolean;
  showShippingAddress: boolean;
}

export interface OrderShippedTemplate {
  subject: string;
  headerText: string;
  footerText: string;
  showTrackingInfo: boolean;
}

export interface BasicEmailTemplate {
  subject: string;
  headerText: string;
  footerText: string;
}

export interface EmailTemplates {
  orderConfirmation: OrderConfirmationTemplate;
  orderShipped: OrderShippedTemplate;
  returnConfirmed: BasicEmailTemplate;
  passwordReset: BasicEmailTemplate;
}

export type EmailTemplateKey = keyof EmailTemplates;

export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = ['orderConfirmation', 'orderShipped', 'returnConfirmed', 'passwordReset'];

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_TEXT_LENGTH = 1000;

/** Boolean fields each template supports. */
const BOOLEAN_FIELDS: Record<EmailTemplateKey, string[]> = {
  orderConfirmation: ['showOrderSummary', 'showShippingAddress'],
  orderShipped: ['showTrackingInfo'],
  returnConfirmed: [],
  passwordReset: [],
};

const TEXT_FIELDS = ['subject', 'headerText', 'footerText'] as const;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  orderConfirmation: {
    subject: 'Your Vellee Luxe order #{orderId}',
    headerText: 'Thank you for your order!',
    footerText: "We'll send you a shipping confirmation as soon as your order is on its way.",
    showOrderSummary: true,
    showShippingAddress: true,
  },
  orderShipped: {
    subject: 'Your Vellee Luxe order #{orderId} has shipped',
    headerText: 'Your order is on the way!',
    footerText: 'Thank you for shopping with Vellee Luxe.',
    showTrackingInfo: true,
  },
  returnConfirmed: {
    subject: 'Return confirmed — Vellee Luxe order #{orderId}',
    headerText: 'Your return has been received.',
    footerText: 'Your refund will be processed within 5–7 business days.',
  },
  passwordReset: {
    subject: 'Reset your Vellee Luxe password',
    headerText: 'Reset your password',
    footerText: 'If you did not request a password reset, you can ignore this email.',
  },
};

export function isEmailTemplateKey(value: unknown): value is EmailTemplateKey {
  return typeof value === 'string' && (EMAIL_TEMPLATE_KEYS as string[]).includes(value);
}

/** Merges a stored template over its defaults, keeping only known fields of the right type. */
function mergeTemplate<K extends EmailTemplateKey>(key: K, stored: unknown): EmailTemplates[K] {
  const result = { ...DEFAULT_EMAIL_TEMPLATES[key] } as Record<string, unknown>;
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return result as unknown as EmailTemplates[K];
  const input = stored as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const value = input[field];
    // Empty subjects fall back to the default; header/footer may be blank on purpose.
    if (typeof value === 'string' && (field !== 'subject' || value.trim())) result[field] = value;
  }
  for (const field of BOOLEAN_FIELDS[key]) {
    if (typeof input[field] === 'boolean') result[field] = input[field];
  }
  return result as unknown as EmailTemplates[K];
}

/**
 * Validates `updates` for one template from a request body.
 * Returns the cleaned partial template, or an error message.
 */
export function parseTemplateUpdates(
  key: EmailTemplateKey,
  updates: unknown,
): { updates: Record<string, string | boolean> } | { error: string } {
  if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
    return { error: 'updates must be an object.' };
  }
  const input = updates as Record<string, unknown>;
  const allowed = new Set<string>([...TEXT_FIELDS, ...BOOLEAN_FIELDS[key]]);
  const cleaned: Record<string, string | boolean> = {};
  for (const [field, value] of Object.entries(input)) {
    if (!allowed.has(field)) return { error: `Unknown field "${field}" for this template.` };
    if ((TEXT_FIELDS as readonly string[]).includes(field)) {
      if (typeof value !== 'string') return { error: `${field} must be text.` };
      const trimmed = value.trim();
      if (field === 'subject') {
        if (!trimmed) return { error: 'Subject line cannot be empty.' };
        if (trimmed.length > MAX_SUBJECT_LENGTH) return { error: `Keep the subject under ${MAX_SUBJECT_LENGTH} characters.` };
      } else if (trimmed.length > MAX_BODY_TEXT_LENGTH) {
        return { error: `Keep ${field} under ${MAX_BODY_TEXT_LENGTH} characters.` };
      }
      cleaned[field] = trimmed;
    } else {
      if (typeof value !== 'boolean') return { error: `${field} must be true or false.` };
      cleaned[field] = value;
    }
  }
  if (Object.keys(cleaned).length === 0) return { error: 'Nothing to save.' };
  return { updates: cleaned };
}

function templatesRef() {
  return getAdminDb().collection('config').doc('emailTemplates');
}

export async function getEmailTemplates(): Promise<EmailTemplates> {
  const snapshot = await templatesRef().get();
  const data = (snapshot.exists ? snapshot.data() : undefined) ?? {};
  return {
    orderConfirmation: mergeTemplate('orderConfirmation', data.orderConfirmation),
    orderShipped: mergeTemplate('orderShipped', data.orderShipped),
    returnConfirmed: mergeTemplate('returnConfirmed', data.returnConfirmed),
    passwordReset: mergeTemplate('passwordReset', data.passwordReset),
  };
}

/**
 * Same as getEmailTemplates, but never throws: if Firestore is unavailable the defaults are
 * used, so a templates read failure can never stop a transactional email from being sent.
 */
export async function getEmailTemplatesSafe(): Promise<EmailTemplates> {
  try {
    return await getEmailTemplates();
  } catch (error) {
    console.error('[email-templates] Could not read templates; using defaults:', error);
    return DEFAULT_EMAIL_TEMPLATES;
  }
}

/** Replaces each whole template given in `updates` (other templates are untouched). */
export async function updateEmailTemplates(updates: Partial<EmailTemplates>): Promise<EmailTemplates> {
  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of EMAIL_TEMPLATE_KEYS) {
    if (updates[key]) payload[key] = updates[key];
  }
  await templatesRef().set(payload, { mergeFields: Object.keys(payload) });
  return getEmailTemplates();
}

/** Replaces `{orderId}` placeholders in a subject or text. */
export function fillPlaceholders(text: string, values: { orderId?: string }): string {
  return text.replace(/\{orderId\}/g, values.orderId ?? '');
}
