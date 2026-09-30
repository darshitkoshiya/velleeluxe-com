/**
 * GET /api/settings — PUBLIC, read-only store settings needed by the storefront.
 *
 * The checkout uses this (not /api/admin/settings, which needs the admin
 * password) to decide whether to show Cash on Delivery.
 */
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS, getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json({ codEnabled: settings.codEnabled });
  } catch (error) {
    console.error('[api/settings] Failed to read settings:', error);
    return NextResponse.json({ codEnabled: DEFAULT_SETTINGS.codEnabled });
  }
}
