import { NextResponse } from 'next/server';
import { getProductBySlug } from '@/lib/sheets';

export const revalidate = 60;

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const product = await getProductBySlug(decodeURIComponent(params.slug));
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error(`[api/product/${params.slug}] Failed:`, error);
    return NextResponse.json({ error: 'Could not load product.' }, { status: 500 });
  }
}
