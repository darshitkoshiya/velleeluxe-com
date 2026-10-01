/**
 * GET  /api/admin/email-templates — returns all email templates (merged with defaults)
 *                                   plus `defaults` (the built-in wording, for "Reset to Default").
 * POST /api/admin/email-templates — body { templateKey: 'orderConfirmation' | 'orderShipped' |
 *                                   'returnConfirmed' | 'passwordReset', updates: { subject?, headerText?,
 *                                   footerText?, show...? } } — saves that one template.
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  DEFAULT_EMAIL_TEMPLATES,
  getEmailTemplates,
  isEmailTemplateKey,
  parseTemplateUpdates,
  updateEmailTemplates,
  type EmailTemplates,
} from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await getEmailTemplates();
    return NextResponse.json({ templates, defaults: DEFAULT_EMAIL_TEMPLATES });
  } catch (error) {
    console.error('[api/admin/email-templates] Failed to read templates:', error);
    return NextResponse.json({ error: 'Could not load email templates.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const input = (body ?? {}) as { templateKey?: unknown; updates?: unknown };
  if (!isEmailTemplateKey(input.templateKey)) {
    return NextResponse.json({ error: 'Unknown templateKey.' }, { status: 400 });
  }
  const key = input.templateKey;

  const parsed = parseTemplateUpdates(key, input.updates);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const current = await getEmailTemplates();
    const next = { ...current[key], ...parsed.updates } as EmailTemplates[typeof key];
    const templates = await updateEmailTemplates({ [key]: next } as Partial<EmailTemplates>);
    return NextResponse.json({ templates, defaults: DEFAULT_EMAIL_TEMPLATES });
  } catch (error) {
    console.error('[api/admin/email-templates] Failed to save templates:', error);
    return NextResponse.json({ error: 'Could not save email templates.' }, { status: 500 });
  }
}
