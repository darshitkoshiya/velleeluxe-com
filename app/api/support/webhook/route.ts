/**
 * POST /api/support/webhook
 *
 * Crisp calls this for every chat message. Visitor messages get an automatic
 * AI reply (Claude Haiku) that knows the store policies and, when the visitor
 * gave an email, their recent orders.
 *
 * Set up in Crisp: Settings > Website Settings > Advanced > Web Hooks
 *   URL:    https://velleeluxe.com/api/support/webhook
 *   Events: message:send
 *   Secret: same value as CRISP_WEBHOOK_SECRET
 *
 * Always answers 200 (even on errors) so Crisp never retries and spams the customer.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  AI_REPLY_PREFIX,
  getCrispConversationEmail,
  getCrispConversationMessages,
  sendCrispMessage,
  verifyCrispWebhook,
} from '@/lib/crisp';
import { DEFAULT_SETTINGS, getStoreSettings, type StoreSettings } from '@/lib/settings';
import { getCustomerSupportContext } from '@/lib/support-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
/** How many earlier chat messages are sent to Claude for context. */
const HISTORY_LIMIT = 10;
const FALLBACK_REPLY =
  "Sorry, I'm having trouble answering right now. Please email support@velleeluxe.com and our team will help you shortly.";

interface CrispWebhookEvent {
  website_id?: string;
  event?: string;
  data?: {
    website_id?: string;
    session_id?: string;
    type?: string;
    from?: string;
    origin?: string;
    content?: unknown;
    fingerprint?: number | string;
    user?: { type?: string; user_id?: string; nickname?: string; email?: string };
  };
}

function ok() {
  return NextResponse.json({ received: true });
}

function buildSystemPrompt(settings: StoreSettings, orderContext: string): string {
  return `You are a friendly customer support agent for Vellee Luxe, a premium men's fashion brand based in India. You are helpful, concise, and professional.

About Vellee Luxe:
- Premium men's shirts and clothing
- Ships across India
- Shipping fee: ₹${settings.shippingFee} (free above ₹${settings.freeShippingThreshold})
- Returns accepted within ${settings.returnWindowByCategory.default ?? 7} days for size exchange or store credit
- Support email: support@velleeluxe.com
- Payment: Razorpay (cards, UPI, net banking)${settings.codEnabled ? ' and Cash on Delivery' : ''}

${orderContext}

Guidelines:
- Keep replies under 100 words
- If asked about a specific order, use the order details above
- If you cannot find the information (e.g. a specific order not in the list), apologise and say you'll escalate to a human agent
- Never make up order statuses, delivery dates, or tracking numbers
- For returns, direct them to velleeluxe.com/returns
- Do not discuss competitors
- Respond in the same language the customer used (Hindi or English)`;
}

type ClaudeMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Turns the Crisp history into alternating user/assistant turns that start with
 * the user and end with the current message (the Messages API requires this).
 */
function buildMessages(
  history: Array<{ from: 'user' | 'operator'; content: string }>,
  currentMessage: string,
): ClaudeMessage[] {
  const recent = history.slice(-HISTORY_LIMIT);
  // The webhook's message is usually already the last one in history; drop it so it isn't duplicated.
  const last = recent[recent.length - 1];
  if (last && last.from === 'user' && last.content.trim() === currentMessage.trim()) recent.pop();

  const messages: ClaudeMessage[] = [];
  for (const entry of [...recent, { from: 'user' as const, content: currentMessage }]) {
    const role = entry.from === 'user' ? 'user' : 'assistant';
    const content =
      role === 'assistant' && entry.content.startsWith(AI_REPLY_PREFIX)
        ? entry.content.slice(AI_REPLY_PREFIX.length).trim()
        : entry.content.trim();
    if (!content) continue;
    const previous = messages[messages.length - 1];
    if (previous && previous.role === role) {
      previous.content += `\n${content}`;
    } else {
      messages.push({ role, content });
    }
  }
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  return messages;
}

async function askClaude(systemPrompt: string, messages: ClaudeMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Claude API failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) throw new Error('Claude API returned an empty reply.');
  return text;
}

/**
 * Records the message fingerprint so the same message is only answered once,
 * even if Crisp delivers the web hook twice. Returns false for a duplicate.
 */
async function claimMessage(websiteId: string, sessionId: string, fingerprint: string): Promise<boolean> {
  const id = `${sessionId}_${fingerprint}`.replace(/[^A-Za-z0-9_-]/g, '_');
  try {
    await getAdminDb()
      .collection('supportWebhookEvents')
      .doc(id)
      .create({ websiteId, sessionId, fingerprint, createdAt: new Date().toISOString() });
    return true;
  } catch (error) {
    // gRPC code 6 = ALREADY_EXISTS (already handled). Any other error: answer anyway.
    if ((error as { code?: number }).code === 6) return false;
    console.error('[support/webhook] Could not record message fingerprint:', error);
    return true;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.CRISP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[support/webhook] CRISP_WEBHOOK_SECRET is not set; ignoring web hook.');
    return ok();
  }
  const signature =
    request.headers.get('x-crisp-hmac-sha256') ?? request.headers.get('x-crisp-signature') ?? '';
  const timestamp = request.headers.get('x-crisp-request-timestamp') ?? undefined;
  if (!verifyCrispWebhook(rawBody, signature, secret, timestamp)) {
    console.warn('[support/webhook] Invalid signature; ignoring.');
    return ok();
  }

  let event: CrispWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CrispWebhookEvent;
  } catch {
    return ok();
  }

  const data = event.data;
  if (event.event !== 'message:send' || !data) return ok();

  // Only answer visitors — never operators or our own bot replies.
  const fromUser = data.from === 'user' && (data.user?.type === undefined || data.user.type === 'user');
  if (!fromUser || data.type !== 'text' || typeof data.content !== 'string') return ok();

  const customerMessage = data.content.trim();
  if (!customerMessage || customerMessage.startsWith(AI_REPLY_PREFIX)) return ok();

  const websiteId = data.website_id ?? event.website_id ?? process.env.CRISP_WEBSITE_ID ?? '';
  const sessionId = data.session_id ?? '';
  if (!websiteId || !sessionId) return ok();

  // Only answer chats on our own Crisp website.
  if (process.env.CRISP_WEBSITE_ID && websiteId !== process.env.CRISP_WEBSITE_ID) {
    console.warn(`[support/webhook] Ignoring message for unknown website ${websiteId}.`);
    return ok();
  }

  if (data.fingerprint !== undefined && !(await claimMessage(websiteId, sessionId, String(data.fingerprint)))) {
    return ok();
  }

  try {
    // Context fetches run in parallel; any failure falls back to safe defaults.
    const [settings, history, email] = await Promise.all([
      getStoreSettings().catch((error) => {
        console.error('[support/webhook] Could not read settings; using defaults:', error);
        return DEFAULT_SETTINGS;
      }),
      getCrispConversationMessages(websiteId, sessionId).catch((error) => {
        console.error('[support/webhook] Could not read conversation history:', error);
        return [] as Array<{ from: 'user' | 'operator'; content: string }>;
      }),
      data.user?.email
        ? Promise.resolve(data.user.email)
        : getCrispConversationEmail(websiteId, sessionId).catch(() => ''),
    ]);

    const orderContext = email
      ? await getCustomerSupportContext(email).catch((error) => {
          console.error('[support/webhook] Could not load order context:', error);
          return '';
        })
      : '';

    let reply: string;
    try {
      reply = await askClaude(buildSystemPrompt(settings, orderContext), buildMessages(history, customerMessage));
    } catch (error) {
      console.error('[support/webhook] Claude request failed:', error);
      reply = FALLBACK_REPLY;
    }

    await sendCrispMessage(websiteId, sessionId, `${AI_REPLY_PREFIX} ${reply}`);
  } catch (error) {
    console.error('[support/webhook] Failed to answer message:', error);
  }

  return ok();
}
