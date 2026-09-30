/**
 * Small helper functions used across the site.
 */

/** Orders at or above this subtotal (INR) ship free. */
export const FREE_SHIPPING_THRESHOLD = 1499;

/** Flat delivery charge (INR) for orders below the free-shipping threshold. */
export const SHIPPING_FEE = 99;

/** Maximum quantity of a single item (size) per order. */
export const MAX_QUANTITY_PER_ITEM = 10;

export const SUPPORT_EMAIL = 'support@velleeluxe.com';

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://velleeluxe.com').replace(/\/$/, '');

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateShipping(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_FEE;
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `VL-${timestamp}-${random}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Joins class names, skipping empty / false values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** "oxford" -> "Oxford", "light-blue" -> "Light Blue" */
export function titleCase(text: string): string {
  return text
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Escapes text before inserting it into HTML (used by email templates). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds a direct-view Google Drive image URL from a file ID. */
export function driveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Pulls a Google Drive file ID out of the common share-link formats:
 *  - https://drive.google.com/file/d/{id}/view
 *  - https://drive.google.com/open?id={id}
 *  - https://drive.google.com/uc?export=view&id={id}
 */
export function extractDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch && url.includes('google.com')) return idMatch[1];
  return null;
}

/** Normalises any Drive link into the direct-view format; other URLs pass through. */
export function normaliseImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.includes('drive.google.com')) {
    const id = extractDriveFileId(trimmed);
    if (id) return driveImageUrl(id);
  }
  return trimmed;
}

/** Short size range hint for product cards, e.g. "S–XXL". */
export function sizeRange(sizes: string[]): string {
  if (sizes.length === 0) return '';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Accepts 10-digit Indian mobile numbers, with optional +91 / 0 prefix and spaces. */
export function normaliseIndianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export function isValidPincode(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode.trim());
}

/** sessionStorage key holding the last placed order (read by the confirmation page). */
export const LAST_ORDER_KEY = 'vl-last-order';

/** Serialises JSON-LD safely for a <script> tag (stops "</script>" in sheet text breaking the page). */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\u003c');
}
