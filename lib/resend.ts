/**
 * Transactional emails via Resend (server-only).
 *
 * Templates are table-based inline-styled HTML so they render correctly in
 * Gmail, Outlook and Apple Mail. The wordmark is styled text (no images).
 */
import { Resend } from 'resend';
import type { ContactRequest, Order, TrackingInfo } from './types';
import { escapeHtml, formatDate, formatPrice, SITE_URL, SUPPORT_EMAIL } from './utils';

const BRAND = {
  linen: '#F6F1E8',
  ink: '#1C2230',
  oxford: '#7D98B3',
  persimmon: '#C8623D',
  sand: '#E4DACB',
  slateGrey: '#6F6A62',
};

const SANS = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'koshiyadarshit94@gmail.com';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set.');
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

function fromAddress(): string {
  return `Vellee Luxe <${process.env.RESEND_FROM_EMAIL || 'orders@velleeluxe.com'}>`;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function send({ to, subject, html, replyTo }: SendArgs): Promise<void> {
  const { error } = await getResend().emails.send({
    from: fromAddress(),
    to,
    subject,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Template building blocks                                            */
/* ------------------------------------------------------------------ */

function layout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vellee Luxe</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.linen};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.linen};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding-bottom:32px;border-bottom:1px solid ${BRAND.sand};">
            <a href="${SITE_URL}" style="text-decoration:none;color:${BRAND.ink};font-family:${SANS};font-size:20px;font-weight:500;letter-spacing:0.3em;">VELLEE LUXE</a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 0;color:${BRAND.ink};font-family:${SERIF};font-size:16px;line-height:1.6;">
            ${content}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;border-top:1px solid ${BRAND.sand};font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.slateGrey};">
            Questions? Write to us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.persimmon};text-decoration:none;">${SUPPORT_EMAIL}</a><br>
            &copy; ${new Date().getFullYear()} Vellee Luxe &middot; <a href="${SITE_URL}" style="color:${BRAND.slateGrey};text-decoration:none;">velleeluxe.com</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function label(text: string): string {
  return `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.oxford};">${escapeHtml(text)}</p>`;
}

function button(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${BRAND.persimmon};border-radius:2px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

function itemsTable(order: Order): string {
  const rows = order.items
    .map(
      (item) => `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${BRAND.sand};font-family:${SANS};font-size:14px;color:${BRAND.ink};">
    ${escapeHtml(item.productName)}<br>
    <span style="font-size:12px;color:${BRAND.slateGrey};">Size ${escapeHtml(item.size)} &middot; Qty ${item.quantity}</span>
  </td>
  <td align="right" style="padding:12px 0;border-bottom:1px solid ${BRAND.sand};font-family:${SANS};font-size:14px;color:${BRAND.ink};white-space:nowrap;">
    ${formatPrice(item.price * item.quantity)}
  </td>
</tr>`,
    )
    .join('');

  const summaryRow = (name: string, value: string, bold = false) => `<tr>
  <td style="padding:6px 0;font-family:${SANS};font-size:14px;color:${bold ? BRAND.ink : BRAND.slateGrey};${bold ? 'font-weight:500;' : ''}">${name}</td>
  <td align="right" style="padding:6px 0;font-family:${SANS};font-size:14px;color:${BRAND.ink};${bold ? 'font-weight:500;' : ''}">${value}</td>
</tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
<tr><td colspan="2" style="height:12px;"></td></tr>
${summaryRow('Subtotal', formatPrice(order.subtotal))}
${summaryRow('Shipping', order.shippingFee > 0 ? formatPrice(order.shippingFee) : 'Free')}
${summaryRow('Total', formatPrice(order.total), true)}
</table>`;
}

function addressBlock(order: Order): string {
  const a = order.shippingAddress;
  const lines = [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, a.country, `Phone: ${a.phone}`]
    .filter((line): line is string => Boolean(line))
    .map(escapeHtml)
    .join('<br>');
  return `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${BRAND.ink};">${lines}</p>`;
}

function paymentLabel(order: Order): string {
  return order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online (Razorpay)';
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

/** Customer: "Thank you for your order". */
export async function sendOrderConfirmation(order: Order): Promise<void> {
  const firstName = escapeHtml(order.customerName.split(' ')[0] || 'there');
  const content = `
    ${label('Order confirmed')}
    <h1 style="margin:0 0 16px;font-family:${SANS};font-size:24px;font-weight:500;color:${BRAND.ink};">Thank you, ${firstName}.</h1>
    <p style="margin:0 0 24px;">Your order <strong style="font-family:${SANS};font-weight:500;">${escapeHtml(order.orderId)}</strong> has been received and is being prepared with care. It will reach you within 5&ndash;7 business days.</p>
    <p style="margin:0 0 32px;font-style:italic;color:${BRAND.slateGrey};">We&rsquo;ll notify you once your order ships.</p>
    ${label('Your order')}
    ${itemsTable(order)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
      <tr>
        <td valign="top" style="padding-right:16px;width:50%;">
          ${label('Shipping to')}
          ${addressBlock(order)}
        </td>
        <td valign="top" style="width:50%;">
          ${label('Payment')}
          <p style="margin:0;font-family:${SANS};font-size:14px;color:${BRAND.ink};">${paymentLabel(order)}</p>
          ${order.paymentMethod === 'cod' ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:13px;color:${BRAND.slateGrey};">Please keep ${formatPrice(order.total)} ready at delivery.</p>` : ''}
        </td>
      </tr>
    </table>
    ${button('View your orders', `${SITE_URL}/account/orders`)}
  `;
  await send({
    to: order.customerEmail,
    subject: `Your Vellee Luxe order ${order.orderId} is confirmed`,
    html: layout(content, `Order ${order.orderId} confirmed — ${formatPrice(order.total)}`),
  });
}

/** Darshit: new order alert with everything needed to source from the wholesaler. */
export async function sendOrderNotification(order: Order): Promise<void> {
  const itemLines = order.items
    .map(
      (item) =>
        `<li style="margin-bottom:6px;">${item.quantity} &times; ${escapeHtml(item.productName)} &mdash; Size <strong>${escapeHtml(item.size)}</strong> (${formatPrice(item.price)} each)</li>`,
    )
    .join('');

  const content = `
    ${label('New order')}
    <h1 style="margin:0 0 8px;font-family:${SANS};font-size:22px;font-weight:500;">${escapeHtml(order.orderId)} &middot; ${formatPrice(order.total)}</h1>
    <p style="margin:0 0 24px;font-family:${SANS};font-size:14px;color:${BRAND.slateGrey};">${formatDate(order.createdAt)} &middot; ${paymentLabel(order)} &middot; Status: ${escapeHtml(order.status)}</p>

    ${label('Items to source')}
    <ul style="margin:0 0 24px;padding-left:20px;font-family:${SANS};font-size:14px;">${itemLines}</ul>

    ${label('Customer')}
    <p style="margin:0 0 24px;font-family:${SANS};font-size:14px;line-height:1.7;">
      ${escapeHtml(order.customerName)}<br>
      <a href="mailto:${escapeHtml(order.customerEmail)}" style="color:${BRAND.persimmon};">${escapeHtml(order.customerEmail)}</a><br>
      <a href="tel:+91${escapeHtml(order.customerPhone)}" style="color:${BRAND.persimmon};">+91 ${escapeHtml(order.customerPhone)}</a><br>
      Account: ${order.customerId === 'guest' ? 'Guest checkout' : escapeHtml(order.customerId)}
    </p>

    ${label('Ship to')}
    ${addressBlock(order)}

    <div style="margin-top:24px;">
      ${label('Totals')}
      ${itemsTable(order)}
    </div>
    ${order.notes ? `<div style="margin-top:24px;">${label('Customer notes')}<p style="margin:0;">${escapeHtml(order.notes)}</p></div>` : ''}
    ${order.razorpayPaymentId ? `<p style="margin:24px 0 0;font-family:${SANS};font-size:12px;color:${BRAND.slateGrey};">Razorpay payment: ${escapeHtml(order.razorpayPaymentId)}</p>` : ''}
  `;
  await send({
    to: ADMIN_EMAIL,
    subject: `New order ${order.orderId} — ${formatPrice(order.total)} (${order.paymentMethod.toUpperCase()})`,
    html: layout(content, `${order.items.length} item(s) for ${order.customerName}`),
    replyTo: order.customerEmail,
  });
}

/** Customer: "Your order is on its way". */
export async function sendShippingConfirmation(order: Order, trackingInfo?: TrackingInfo): Promise<void> {
  const firstName = escapeHtml(order.customerName.split(' ')[0] || 'there');
  const trackingParts = trackingInfo
    ? [trackingInfo.courier, trackingInfo.trackingNumber].filter((part) => Boolean(part && part.trim())).map(escapeHtml)
    : [];
  const tracking = trackingInfo && trackingParts.length > 0
    ? `${label('Tracking')}
       <p style="margin:0 0 8px;font-family:${SANS};font-size:14px;">${trackingParts.join(' &middot; ')}</p>
       ${trackingInfo.url ? button('Track your parcel', trackingInfo.url) : ''}`
    : '';

  const content = `
    ${label('Shipped')}
    <h1 style="margin:0 0 16px;font-family:${SANS};font-size:24px;font-weight:500;">Your order is on its way, ${firstName}.</h1>
    <p style="margin:0 0 32px;">Order <strong style="font-family:${SANS};font-weight:500;">${escapeHtml(order.orderId)}</strong> has left us and should reach you in the next few days.</p>
    ${tracking}
    <div style="margin-top:24px;">
      ${label('In this parcel')}
      ${itemsTable(order)}
    </div>
    <div style="margin-top:32px;">
      ${label('Delivering to')}
      ${addressBlock(order)}
    </div>
    ${trackingInfo?.url ? '' : button('View your orders', `${SITE_URL}/account/orders`)}
  `;
  await send({
    to: order.customerEmail,
    subject: `Your Vellee Luxe order ${order.orderId} has shipped`,
    html: layout(content, `Order ${order.orderId} is on its way`),
  });
}

/** Contact form message forwarded to the store inbox. */
export async function sendContactMessage(message: ContactRequest): Promise<void> {
  const content = `
    ${label('Contact form')}
    <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.7;">
      <strong>${escapeHtml(message.name)}</strong><br>
      <a href="mailto:${escapeHtml(message.email)}" style="color:${BRAND.persimmon};">${escapeHtml(message.email)}</a>
    </p>
    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message.message)}</p>
  `;
  await send({
    to: ADMIN_EMAIL,
    subject: `Contact form: ${message.name}`,
    html: layout(content, message.message.slice(0, 90)),
    replyTo: message.email,
  });
}
