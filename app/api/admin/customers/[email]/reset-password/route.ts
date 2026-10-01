/**
 * /api/admin/customers/[email]/reset-password — emails the customer a Firebase password reset link.
 *
 * POST -> { ok: true } | { error }
 * 404 when the email has no Firebase account (guest checkout).
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/lib/resend';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function decodeEmail(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
}

export async function POST(_request: Request, { params }: { params: { email: string } }) {
  const email = decodeEmail(params.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  let link: string;
  try {
    link = await getAdminAuth().generatePasswordResetLink(email);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'auth/user-not-found' || code === 'auth/email-not-found') {
      return NextResponse.json(
        { error: 'This customer has no account (guest checkout), so there is no password to reset.' },
        { status: 404 },
      );
    }
    console.error('[api/admin/customers/reset-password] Could not generate link:', error);
    return NextResponse.json({ error: 'Could not create a password reset link.' }, { status: 500 });
  }

  try {
    await sendPasswordResetEmail(email, link);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/admin/customers/reset-password] Could not send email:', error);
    return NextResponse.json({ error: 'Could not send the reset email. Please try again.' }, { status: 500 });
  }
}
