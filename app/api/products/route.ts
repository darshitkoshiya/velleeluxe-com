import { NextResponse } from 'next/server';
import { getLiveCatalogProducts } from '@/lib/catalog';

// Rebuild this response at most once every 3 hours (override writes revalidate the layout).
export const revalidate = 10800;

export async function GET() {
  try {
    // Uses the live catalogue so admin overrides (price, title, hidden) are respected.
    const products = await getLiveCatalogProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error('[api/products] Failed:', error);
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 });
  }
}
