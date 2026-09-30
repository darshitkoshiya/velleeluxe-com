/**
 * POST /api/contact — forwards a contact-form message to the store inbox.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sendContactMessage } from '@/lib/resend';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot: bots fill every field. Pretend success so they move on.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ success: true });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 3000) : '';

  if (name.length < 2) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: 'Please write a longer message.' }, { status: 400 });

  try {
    await sendContactMessage({ name, email, message });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/contact] Failed to send message:', error);
    return NextResponse.json(
      { error: 'We could not send your message right now. Please email support@velleeluxe.com directly.' },
      { status: 500 },
    );
  }
}
