import { notFound } from 'next/navigation'
import Image from 'next/image'
import { apiServer } from '@/lib/server-api'
import type { ProductDetail } from '@nearbuy/api'
import { PriceBlock, Stars, Badge, Card, s, formatINR, SectionHeader } from '@nearbuy/ui'
import { PurchasePanel } from './purchase'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await apiServer<ProductDetail>(`/products/${params.slug}`)
  if (!product) notFound()
  const img = product.images?.[0]?.url ?? `/images/products/${product.slug}.jpg`
  const stores = await apiServer<{ options: unknown[] }>(`/fulfillment/methods?productId=${product.id}&qty=1&lat=28.5921&lng=77.046`)

  return (
    <div className="nb-container py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org', '@type': 'Product', name: product.name,
            image: [img], description: product.description,
            aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.ratingCount },
            offers: { '@type': 'Offer', price: product.price?.onlinePrice, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
          }),
        }}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr,380px]">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-card">
            <Image src={img} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 640px" className="object-contain p-8" />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Card className="p-4">
              <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink">{s('product.details', 'Details')}</p>
              <p className="text-sm text-ink-secondary">{product.description}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">{s('product.brand', 'Brand')}</dt><dd className="font-semibold">{product.brand?.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{s('product.sku', 'SKU')}</dt><dd className="font-mono text-xs">{product.sku}</dd></div>
                {product.specs && Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>
                ))}
              </dl>
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink">{s('product.reviews', 'Ratings & reviews')}</p>
              <Stars rating={product.rating} count={product.ratingCount} />
              <ul className="mt-3 space-y-2">
                {(product.reviews ?? []).slice(0, 3).map((r) => (
                  <li key={r.id} className="rounded-card bg-canvas p-3 text-sm">
                    <Stars rating={r.rating} /> <span className="ml-2 font-bold text-ink">{r.userName}</span>
                    {r.body && <p className="mt-1 text-ink-secondary">{r.body}</p>}
                  </li>
                ))}
                {(!product.reviews || product.reviews.length === 0) && <li className="text-sm text-ink-muted">{s('product.noReviews', 'No reviews yet.')}</li>}
              </ul>
            </Card>
          </div>
        </div>

        {/* Purchase column */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">{product.brand?.name} · {product.category?.name}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{product.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <Stars rating={product.rating} count={product.ratingCount} />
              {product.tags?.includes('deals') && <Badge tone="accent">{s('product.deal', 'Deal')}</Badge>}
            </div>
            {product.price && (
              <div className="mt-3">
                <PriceBlock price={product.price.onlinePrice} mrp={product.price.mrp} size="lg" />
                <p className="mt-1 text-xs text-ink-muted">{s('product.inclusiveTax', 'Inclusive of all taxes')}</p>
              </div>
            )}
          </div>
          <PurchasePanel productId={product.id} slug={product.slug} name={product.name} />
        </div>
      </div>

      {/* FOUND NEARBY strip */}
      <section className="mt-12">
        <SectionHeader title={s('foundNearby.title', 'FOUND NEARBY')} />
        <p className="text-sm text-ink-muted">
          {(stores?.options ?? []).length > 0
            ? s('product.availableNearby', 'Available nearby') + ` · ${formatINR(product.price?.onlinePrice ?? 0)}`
            : s('product.noOptions', 'No fulfillment options for this product right now.')}
        </p>
      </section>
    </div>
  )
}
