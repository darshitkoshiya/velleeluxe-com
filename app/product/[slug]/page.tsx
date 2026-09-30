import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/product/AddToCart';
import { ProductImages } from '@/components/product/ProductImages';
import { SizeChartTable } from '@/components/product/SizeChartTable';
import { getProductBySlug, getProducts } from '@/lib/sheets';
import type { Product } from '@/lib/types';
import { formatPrice, SITE_URL, titleCase, toJsonLd } from '@/lib/utils';

// Rebuild each product page at most once a minute; new products are built on first visit.
export const revalidate = 60;

interface ProductPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    return { title: 'Product not found', robots: { index: false } };
  }
  const title = product.seoTitle || product.name;
  const description =
    product.seoDescription || product.description.slice(0, 155) || `${product.name} — premium men's shirt by Vellee Luxe.`;
  return {
    // `absolute` stops the " — Vellee Luxe" suffix being added twice when seoTitle already includes it.
    title: product.seoTitle ? { absolute: product.seoTitle } : title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/product/${product.slug}`,
      images: product.images.slice(0, 1).map((url) => ({ url, alt: product.name })),
    },
  };
}

function productJsonLd(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.seoDescription || product.description,
    image: product.images,
    sku: product.id,
    brand: { '@type': 'Brand', name: 'Vellee Luxe' },
    color: titleCase(product.colour),
    material: titleCase(product.style),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: 'INR',
      price: product.price,
      availability: product.stock === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  const details = [
    { label: 'Fabric', value: product.style },
    { label: 'Colour', value: product.colour },
    { label: 'Fit', value: product.fit },
  ].filter((d) => d.value);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productJsonLd(product)) }} />

      <div className="container-page py-8 md:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 font-sans text-xs text-slateGrey">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-persimmon">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/shop" className="hover:text-persimmon">
                Shop
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductImages images={product.images} productName={product.name} />

          <div className="lg:sticky lg:top-24 lg:self-start">
            <h1 className="font-sans text-2xl font-medium leading-tight text-ink">{product.name}</h1>

            <p className="mt-4 flex items-baseline gap-3 font-sans">
              <span className="text-2xl font-medium text-ink">{formatPrice(product.price)}</span>
              {product.compareAtPrice ? (
                <span className="text-base text-pebble line-through">
                  <span className="sr-only">Was </span>
                  {formatPrice(product.compareAtPrice)}
                </span>
              ) : null}
            </p>
            <p className="mt-1 font-sans text-xs text-slateGrey">Inclusive of all taxes</p>

            {details.length > 0 ? (
              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-sand py-4 font-sans text-xs">
                {details.map((d) => (
                  <div key={d.label} className="flex gap-2">
                    <dt className="uppercase tracking-[0.14em] text-slateGrey">{d.label}</dt>
                    <dd className="text-ink">{titleCase(d.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mb-3 mt-8 flex items-center justify-between">
              <span className="label-caps text-ink">Size</span>
              <a href="#size-guide" className="font-sans text-xs text-slateGrey underline underline-offset-4 hover:text-persimmon">
                Size guide
              </a>
            </div>
            <AddToCart product={product} />

            <ul className="mt-8 space-y-2 font-sans text-xs text-slateGrey">
              <li>Free shipping on orders above ₹1,499</li>
              <li>Delivered in 5–7 business days across India</li>
              <li>
                7-day returns —{' '}
                <Link href="/return-policy" className="underline underline-offset-4 hover:text-persimmon">
                  see policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 grid gap-12 border-t border-sand pt-12 lg:mt-24 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="description-title">
            <h2 id="description-title" className="label-caps mb-5 text-ink">
              Description
            </h2>
            <div className="whitespace-pre-line font-serif text-lg leading-relaxed text-slateGrey">
              {product.description || 'Details coming soon.'}
            </div>

            {product.careInstructions ? (
              <>
                <h2 className="label-caps mb-4 mt-10 text-ink">Care</h2>
                <p className="whitespace-pre-line font-serif text-base leading-relaxed text-slateGrey">
                  {product.careInstructions}
                </p>
              </>
            ) : null}
          </section>

          <section aria-labelledby="size-guide" className="scroll-mt-24">
            <h2 id="size-guide" className="label-caps mb-5 text-ink">
              Size Guide
            </h2>
            <SizeChartTable />
            <p className="mt-4 font-serif text-sm italic text-slateGrey">
              Between sizes? Choose the larger size for a relaxed feel.{' '}
              <Link href="/size-guide" className="not-italic text-persimmon underline underline-offset-4">
                How to measure
              </Link>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
