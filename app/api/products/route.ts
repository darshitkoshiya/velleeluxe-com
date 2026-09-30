import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/sheets';

// Rebuild this response at most once every 60 seconds.
export const revalidate = 60;

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error('[api/products] Failed:', error);
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 });
  }
}
