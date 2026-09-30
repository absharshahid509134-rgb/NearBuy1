'use client'
import * as React from 'react'
import Link from 'next/link'
import { useNearbyStores, useStoreProducts } from '@nearbuy/api'
import { Card, Badge, LoadingBlock, ProductCard, s, SectionHeader, Button } from '@nearbuy/ui'

export default function StoreDetailPage({ params }: { params: { slug: string } }) {
  const { data: stores } = useNearbyStores(50)
  const { data: products, isLoading } = useStoreProducts(params.slug)
  const store = (stores ?? []).find((st) => st.slug === params.slug)

  return (
    <div className="nb-container py-6">
      {store && (
        <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-card bg-canvas text-5xl">{store.emoji}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{store.name}</h1>
            <p className="text-sm text-ink-secondary">{store.area} · {store.category} · {store.hours}</p>
            <p className="mt-1 flex flex-wrap gap-1">
              <Badge tone="success">📍 {store.distanceKm} km · {store.travelMins} min</Badge>
              {store.pickupEnabled && <Badge tone="info">{s('status.pickup', 'Pickup')}</Badge>}
              {store.localDelivery && <Badge tone="reserve">{s('status.localDelivery', 'Local delivery')}</Badge>}
              {store.verified && <Badge tone="accent">✓ {s('status.verified', 'Verified')}</Badge>}
            </p>
          </div>
          <Link href="/search"><Button variant="outline">{s('nav.search', 'Search')}</Button></Link>
        </Card>
      )}
      <SectionHeader title={s('store.products', 'Products in this store')} />
      {isLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(products ?? []).map((p) => (
            <ProductCard key={p.id} product={{ productId: p.id, slug: p.slug, name: p.name, emoji: p.emoji, price: 0, rating: p.rating }} />
          ))}
        </div>
      )}
    </div>
  )
}
