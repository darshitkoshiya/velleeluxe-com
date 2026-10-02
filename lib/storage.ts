/**
 * Firebase Storage helpers (server-only).
 * Only active when FIREBASE_STORAGE_BUCKET is set.
 */
import { getStorage } from 'firebase-admin/storage';
import { createHash } from 'crypto';
import { getAdminDb } from './firebase-admin';
import { getStoreSettings } from './settings';

export function isStorageConfigured(): boolean {
  return Boolean(process.env.FIREBASE_STORAGE_BUCKET);
}

/**
 * True only when the bucket is configured AND the admin chose "Firebase Storage"
 * as the image mode in /admin/settings. Falls back to false on any read error.
 */
export async function isStorageModeActive(): Promise<boolean> {
  if (!isStorageConfigured()) return false;
  try {
    const settings = await getStoreSettings();
    return settings.imageStorageMode === 'firebase';
  } catch {
    return false;
  }
}

function getAdminStorage() {
  getAdminDb(); // ensure Firebase app is initialized
  return getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
}

/**
 * Returns a content-hash-based filename for a URL.
 * e.g. "https://example.com/photo.jpg" → "abc123def456.jpg"
 * Uses the URL's path extension, falls back to ".jpg".
 */
function storageFilename(originalUrl: string): string {
  const hash = createHash('md5').update(originalUrl).digest('hex');
  const ext = originalUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) ? ext : 'jpg';
  return `${hash}.${safeExt}`;
}

function buildPublicUrl(bucket: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/**
 * Downloads an image from `originalUrl` and uploads it to Firebase Storage at
 * `products/images/{listingSku}/{filename}`. Returns the public Firebase Storage URL.
 *
 * Returns `originalUrl` unchanged if:
 * - Storage is not configured (FIREBASE_STORAGE_BUCKET not set)
 * - The URL is already a Firebase Storage URL
 * - The download or upload fails
 */
export async function mirrorImageUrl(originalUrl: string, listingSku: string): Promise<string> {
  if (!(await isStorageModeActive())) return originalUrl;
  return mirrorOne(originalUrl, listingSku);
}

/** Mirrors one URL without checking the mode (callers check it once). */
async function mirrorOne(originalUrl: string, listingSku: string): Promise<string> {
  if (originalUrl.includes('firebasestorage.googleapis.com')) return originalUrl;

  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET as string;
    const filename = storageFilename(originalUrl);
    const storagePath = `products/images/${listingSku}/${filename}`;
    const bucket = getAdminStorage();
    const file = bucket.file(storagePath);

    // Skip if already uploaded.
    const [exists] = await file.exists();
    if (exists) return buildPublicUrl(bucketName, storagePath);

    // Download the image.
    const response = await fetch(originalUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return originalUrl;
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return originalUrl;
    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to Firebase Storage.
    await file.save(buffer, { metadata: { contentType }, resumable: false });
    await file.makePublic();

    return buildPublicUrl(bucketName, storagePath);
  } catch {
    // Never fail the sync over an image — return the original URL.
    return originalUrl;
  }
}

/**
 * Mirrors all image URLs for a listing. Returns the mirrored array.
 * If storage is not configured or the image mode is 'link', returns the original array unchanged.
 */
export async function mirrorListingImages(images: string[], listingSku: string): Promise<string[]> {
  if (images.length === 0 || !(await isStorageModeActive())) return images;
  return Promise.all(images.map((url) => mirrorOne(url, listingSku)));
}

/**
 * Deletes all Firebase Storage files whose paths start with `products/images/{listingSku}/`.
 * No-op when storage is not configured or the listing has no Storage images.
 * Runs regardless of the image mode, so files mirrored earlier are still cleaned up.
 * Never throws.
 */
export async function deleteListingImages(images: string[], listingSku: string): Promise<void> {
  if (!isStorageConfigured() || !listingSku) return;
  const prefix = `products/images/${listingSku}/`;
  // Only act when the listing actually references files in our Storage bucket.
  const hasStorageImages = images.some(
    (url) => url.includes('firebasestorage.googleapis.com') && url.includes(encodeURIComponent(prefix)),
  );
  if (!hasStorageImages) return;
  try {
    const bucket = getAdminStorage();
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch (error) {
    // Never fail a delete over storage cleanup — log and continue.
    console.warn(`[storage] Could not clean up images for listing ${listingSku}:`, error);
  }
}
