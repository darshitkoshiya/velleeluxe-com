import { NextResponse } from 'next/server';
import { getLiveCatalogProducts } from '@/lib/catalog';

export const revalidate = 10800;

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = decodeURIComponent(params.slug);
    // Uses the live catalogue so admin overrides (price, title, hidden) are respected.
    const products = await getLiveCatalogProducts();
    const product = products.find((p) => p.slug === slug);
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error(`[api/product/${params.slug}] Failed:`, error);
    return NextResponse.json({ error: 'Could not load product.' }, { status: 500 });
  }
}
