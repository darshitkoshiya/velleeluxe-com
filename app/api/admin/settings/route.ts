/**
 * GET  /api/admin/settings — returns { codEnabled }
 * POST /api/admin/settings — body { codEnabled: boolean }
 *
 * Protected by HTTP Basic Auth in middleware.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStoreSettings, updateStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json({ codEnabled: settings.codEnabled });
  } catch (error) {
    console.error('[api/admin/settings] Failed to read settings:', error);
    return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const codEnabled = (body as { codEnabled?: unknown } | null)?.codEnabled;
  if (typeof codEnabled !== 'boolean') {
    return NextResponse.json({ error: 'codEnabled must be true or false.' }, { status: 400 });
  }

  try {
    const settings = await updateStoreSettings({ codEnabled });
    return NextResponse.json({ codEnabled: settings.codEnabled });
  } catch (error) {
    console.error('[api/admin/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
