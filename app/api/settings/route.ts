/**
 * GET /api/settings — PUBLIC, read-only store settings needed by the storefront.
 *
 * The checkout and cart use this (not /api/admin/settings, which needs the admin
 * password) to decide whether to show Cash on Delivery and when shipping is free.
 */
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS, getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json({
      codEnabled: settings.codEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
      returnWindowByCategory: settings.returnWindowByCategory,
    });
  } catch (error) {
    console.error('[api/settings] Failed to read settings:', error);
    return NextResponse.json({
      codEnabled: DEFAULT_SETTINGS.codEnabled,
      freeShippingThreshold: DEFAULT_SETTINGS.freeShippingThreshold,
      returnWindowByCategory: DEFAULT_SETTINGS.returnWindowByCategory,
    });
  }
}
