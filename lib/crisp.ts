/**
 * Crisp chat REST API helpers (server-only — uses the Crisp API key).
 *
 * Auth: HTTP Basic with base64(CRISP_IDENTIFIER:CRISP_KEY) plus the `X-Crisp-Tier: plugin` header.
 * Docs: https://docs.crisp.chat/references/rest-api/v1/
 */
import crypto from 'crypto';

export const CRISP_BASE = 'https://api.crisp.chat/v1';

/** Prefix on every AI reply, so the webhook can ignore our own messages and never loop. */
export const AI_REPLY_PREFIX = '[AI]';

function crispHeaders(): Record<string, string> {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  if (!identifier || !key) {
    throw new Error('CRISP_IDENTIFIER and CRISP_KEY must be set.');
  }
  return {
    Authorization: `Basic ${Buffer.from(`${identifier}:${key}`).toString('base64')}`,
    'X-Crisp-Tier': 'plugin',
    'Content-Type': 'application/json',
  };
}

function conversationUrl(websiteId: string, sessionId: string, suffix: string): string {
  return `${CRISP_BASE}/website/${encodeURIComponent(websiteId)}/conversation/${encodeURIComponent(sessionId)}/${suffix}`;
}

/** Posts a text reply into the conversation as an operator. */
export async function sendCrispMessage(websiteId: string, sessionId: string, text: string): Promise<void> {
  const response = await fetch(conversationUrl(websiteId, sessionId, 'message'), {
    method: 'POST',
    headers: crispHeaders(),
    body: JSON.stringify({ type: 'text', from: 'operator', origin: 'chat', content: text }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Crisp send message failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

interface CrispRawMessage {
  type?: string;
  from?: string;
  content?: unknown;
  timestamp?: number;
}

/**
 * The latest text messages in the conversation (oldest first).
 * Non-text messages (files, pickers, notes) are skipped.
 */
export async function getCrispConversationMessages(
  websiteId: string,
  sessionId: string,
): Promise<Array<{ from: 'user' | 'operator'; content: string }>> {
  const response = await fetch(conversationUrl(websiteId, sessionId, 'messages'), {
    method: 'GET',
    headers: crispHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Crisp get messages failed (${response.status})`);
  }
  const json = (await response.json()) as { data?: CrispRawMessage[] };
  const messages = Array.isArray(json.data) ? json.data : [];
  return messages
    .filter(
      (m): m is CrispRawMessage & { content: string; from: 'user' | 'operator' } =>
        m.type === 'text' &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0 &&
        (m.from === 'user' || m.from === 'operator'),
    )
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    .map((m) => ({ from: m.from, content: m.content }));
}

/** The email the visitor gave Crisp for this conversation, or '' if none. */
export async function getCrispConversationEmail(websiteId: string, sessionId: string): Promise<string> {
  const response = await fetch(conversationUrl(websiteId, sessionId, 'meta'), {
    method: 'GET',
    headers: crispHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) return '';
  const json = (await response.json()) as { data?: { email?: unknown } };
  return typeof json.data?.email === 'string' ? json.data.email.trim() : '';
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Verifies a Crisp web hook signature (HMAC-SHA256, hex).
 *
 * Accepts the signature with or without a "sha256=" prefix. When `timestamp` is given
 * (the X-Crisp-Request-Timestamp header), Crisp's documented `[timestamp;body]` format
 * is also accepted, as well as an HMAC of the plain body.
 */
export function verifyCrispWebhook(body: string, signature: string, secret: string, timestamp?: string): boolean {
  if (!body || !signature || !secret) return false;
  const received = signature.trim().replace(/^sha256=/i, '').toLowerCase();
  const hmac = (payload: string) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (safeEqualHex(received, hmac(body))) return true;
  if (timestamp && safeEqualHex(received, hmac(`[${timestamp};${body}]`))) return true;
  return false;
}
