import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/product/AddToCart';
import { ProductAccordion } from '@/components/product/ProductAccordion';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductImages } from '@/components/product/ProductImages';
import { SizeChartTable } from '@/components/product/SizeChartTable';
import { ViewTracker } from '@/components/product/ViewTracker';
import { swatchClass } from '@/components/product/ColourSwatch';
import {
  buildColourVariantMap,
  getBestSellerIds,
  getCatalog,
  getCatalogProductBySlug,
  getCatalogProductsByDesignId,
  getRelatedProducts,
} from '@/lib/catalog';
import { getFreeShippingThreshold } from '@/lib/settings';
import type { Product } from '@/lib/types';
import { cn, displayPrice, formatPrice, isProductOutOfStock, SITE_URL, titleCase, toJsonLd } from '@/lib/utils';

// Rebuild each product page at most once a minute; new products are built on first visit.
export const revalidate = 10800;

interface ProductPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getCatalogProductBySlug(params.slug);
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
  const product = await getCatalogProductBySlug(params.slug);
  if (!product) notFound();

  const { products, isMock } = await getCatalog();
  const freeShippingLabel = formatPrice(await getFreeShippingThreshold());
  const related = getRelatedProducts(product, products, 4);
  const bestSellerIds = isMock ? getBestSellerIds() : [];
  const colourVariantMap = buildColourVariantMap(products);
  const colourSiblings = product.designId ? await getCatalogProductsByDesignId(product.designId) : [product];

  const details = [
    { label: 'Fabric', value: product.style },
    { label: 'Colour', value: product.colour },
    { label: 'Fit', value: product.fit },
  ].filter((d) => d.value);

  // Out of stock: show MRP only — no strike-through, no discount.
  const outOfStock = isProductOutOfStock(product);
  const showCompareAt = !outOfStock && Boolean(product.compareAtPrice);
  const discount =
    showCompareAt && product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productJsonLd(product)) }} />
      <ViewTracker slug={product.slug} />

      <div className="container-page py-6 md:py-12">
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
            <li aria-current="page" className="truncate text-ink">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-2 md:gap-10 lg:gap-16">
          <ProductImages images={product.images} productName={product.name} />

          <div className="md:sticky md:top-24 md:self-start">
            {product.style ? <p className="label-caps text-oxford">{titleCase(product.style)}</p> : null}
            <h1 className="mt-2 font-sans text-2xl font-medium leading-tight text-ink md:text-3xl">{product.name}</h1>

            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 font-sans">
              <span className="text-2xl font-medium text-ink">{formatPrice(displayPrice(product))}</span>
              {showCompareAt && product.compareAtPrice ? (
                <>
                  <span className="text-base text-pebble line-through">
                    <span className="sr-only">Was </span>
                    {formatPrice(product.compareAtPrice)}
                  </span>
                  {discount > 0 ? (
                    <span className="bg-persimmon px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white">
                      {discount}% off
                    </span>
                  ) : null}
                </>
              ) : null}
            </p>
            <p className="mt-1 font-sans text-xs text-slateGrey">Inclusive of all taxes</p>

            {colourSiblings.length > 1 ? (
              <div className="mt-5">
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-slateGrey">
                  Colour — <span className="text-ink">{titleCase(product.colour)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colourSiblings.map((sibling) => (
                    <Link
                      key={sibling.slug}
                      href={`/product/${sibling.slug}`}
                      aria-label={titleCase(sibling.colour)}
                      aria-current={sibling.slug === product.slug ? 'true' : undefined}
                      title={titleCase(sibling.colour)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                        sibling.slug === product.slug ? 'border-ink' : 'border-transparent hover:border-pebble',
                      )}
                    >
                      <span
                        className={cn('h-5 w-5 rounded-full border border-pebble/40', swatchClass(sibling.colour))}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {details.length > 0 ? (
              <dl className="mb-8 mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-sand py-4 font-sans text-xs">
                {details.map((d) => (
                  <div key={d.label} className="flex gap-2">
                    <dt className="uppercase tracking-[0.14em] text-slateGrey">{d.label}</dt>
                    <dd className="text-ink">{titleCase(d.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mb-8" />
            )}

            <AddToCart product={product} />

            <ul className="mt-8 grid grid-cols-1 gap-2 font-sans text-xs text-slateGrey sm:grid-cols-3 sm:gap-4">
              <li className="border-l-2 border-sand pl-3">Free shipping above {freeShippingLabel}</li>
              <li className="border-l-2 border-sand pl-3">Delivered in 5–7 days</li>
              <li className="border-l-2 border-sand pl-3">
                7-day{' '}
                <Link href="/return-policy" className="underline underline-offset-4 hover:text-persimmon">
                  returns
                </Link>
              </li>
            </ul>

            <div className="mt-8 border-t border-sand">
              <ProductAccordion title="Description" defaultOpen>
                <div className="whitespace-pre-line font-serif text-base leading-relaxed text-slateGrey">
                  {product.description || 'Details coming soon.'}
                </div>
              </ProductAccordion>

              <ProductAccordion title="Fabric & Care">
                <dl className="space-y-2 font-sans text-sm">
                  {product.style ? (
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slateGrey">Fabric</dt>
                      <dd className="text-ink">{titleCase(product.style)}</dd>
                    </div>
                  ) : null}
                  {product.fit ? (
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slateGrey">Fit</dt>
                      <dd className="text-ink">{titleCase(product.fit)}</dd>
                    </div>
                  ) : null}
                </dl>
                {product.careInstructions ? (
                  <p className="mt-4 whitespace-pre-line font-serif text-base leading-relaxed text-slateGrey">
                    {product.careInstructions}
                  </p>
                ) : null}
              </ProductAccordion>

              <ProductAccordion id="size-guide" title="Size Guide">
                <SizeChartTable />
                <p className="mt-4 font-serif text-sm italic text-slateGrey">
                  Between sizes? Choose the larger size for a relaxed feel.{' '}
                  <Link href="/size-guide" className="not-italic text-persimmon underline underline-offset-4">
                    How to measure
                  </Link>
                </p>
              </ProductAccordion>

              <ProductAccordion title="Shipping & Returns">
                <ul className="space-y-2 font-serif text-base leading-relaxed text-slateGrey">
                  <li>Free shipping on orders above {freeShippingLabel}. A flat fee applies below that.</li>
                  <li>Dispatched within 1–2 business days, delivered in 5–7 business days across India.</li>
                  <li>
                    Easy 7-day returns on unworn items with tags attached.{' '}
                    <Link href="/return-policy" className="text-persimmon underline underline-offset-4">
                      Read the policy
                    </Link>
                  </li>
                </ul>
              </ProductAccordion>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className="mt-20 border-t border-sand pt-12 md:mt-28">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 id="related-title" className="font-sans text-xl font-medium text-ink md:text-2xl">
                You May Also Like
              </h2>
              <Link
                href="/shop"
                className="shrink-0 font-sans text-xs uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-persimmon"
              >
                View all
              </Link>
            </div>
            <ProductGrid products={related} className="md:grid-cols-4 lg:grid-cols-4" bestSellerIds={bestSellerIds}
              colourVariantMap={colourVariantMap}
            />
          </section>
        ) : null}

        {/* Room for the sticky mobile Add to Bag bar */}
        <div className="h-16 md:hidden" aria-hidden="true" />
      </div>
    </>
  );
}
