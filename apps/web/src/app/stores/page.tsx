'use client'
import * as React from 'react'
import Link from 'next/link'
import { useNearbyStores } from '@nearbuy/api'
import { Card, Badge, LoadingBlock, ErrorBlock, EmptyState, s, SectionHeader } from '@nearbuy/ui'

export default function StoresPage() {
  const { data, isLoading, error, refetch } = useNearbyStores(24)
  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('home.localStores', 'Local stores near you')} />
      {isLoading && <LoadingBlock />}
      {error && <ErrorBlock message={error.message} retry={() => void refetch()} />}
      {data && data.length === 0 && <EmptyState title={s('stores.empty', 'No stores in range')} hint={s('stores.emptyHint', 'Widen your area — more shops are joining Nearby every week.')} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((st) => (
          <Link key={st.id} href={`/stores/${st.slug}`}>
            <Card className="flex gap-3 p-4 hover:border-primary-300">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-canvas text-4xl">{st.emoji}</div>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{st.name}</p>
                <p className="text-sm text-ink-secondary">{st.area} · {st.category}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="success">📍 {st.distanceKm} km</Badge>
                  <Badge tone="reserve">⚡ {st.travelMins} min</Badge>
                  {st.pickupEnabled && <Badge tone="info">{s('status.pickup', 'Pickup')}</Badge>}
                  {st.verified && <Badge tone="accent">✓ {s('status.verified', 'Verified')}</Badge>}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{st.hours} · {st.inStockProducts} {s('stores.inStock', 'in stock')}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
