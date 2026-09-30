/**
 * Commerce components: price blocks, ratings, stock chips, product cards.
 * Server computes amounts; UI only renders them (§87 — no money logic here).
 */
'use client'
import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn, formatINR } from './index'
import { s, statusTone, type BadgeTone } from './strings'
import { Badge } from './primitives'

export function PriceBlock({ price, mrp, size = 'md' }: { price: number; mrp?: number; size?: 'sm' | 'md' | 'lg' }) {
  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={cn('font-bold tracking-tight text-ink', size === 'lg' ? 'text-price-lg' : size === 'sm' ? 'text-base' : 'text-price')}>
        {formatINR(price)}
      </span>
      {mrp && mrp > price && (
        <>
          <span className="text-sm text-ink-muted line-through">{formatINR(mrp)}</span>
          <span className="text-sm font-bold text-success-600">{discount}% {s('product.off', 'OFF')}</span>
        </>
      )}
    </div>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`${rating} out of 5`}>
      <span className="font-bold text-ink-secondary">{rating.toFixed(1)}</span>
      <span aria-hidden className="text-accent-500">★</span>
      {count !== undefined && <span className="text-ink-muted">({count})</span>}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTone(status) as BadgeTone
  return <Badge tone={tone} className={className}>{status.replaceAll('_', ' ')}</Badge>
}

export function StockChip({ units, openNow }: { units: number; openNow?: boolean }) {
  if (units <= 0) return <Badge tone="error">{s('status.outOfStock', 'Out of stock')}</Badge>
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone="success">📍 {s('status.nearby', 'Nearby')} · ✓ {s('status.available', 'Available')}</Badge>
      {openNow === false && <Badge tone="neutral">{s('status.closedNow', 'Closed now')}</Badge>}
    </span>
  )
}

export function FoundNearbyChip({ stores, units, closestKm, fastestMins, confidence }: {
  stores: number; units: number; closestKm: number | null; fastestMins: number | null; confidence: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge tone="accent">{s('foundNearby.title', 'FOUND NEARBY')}</Badge>
      <span className="font-semibold text-ink-secondary">{stores} {s('foundNearby.stores', 'stores')} · {units} {s('foundNearby.units', 'available units')}</span>
      {closestKm !== null && <Badge tone="info">📍 {s('foundNearby.closest', 'Closest')} {closestKm} km</Badge>}
      {fastestMins !== null && <Badge tone="reserve">⚡ {s('foundNearby.fastest', 'Fastest')} {fastestMins} min</Badge>}
      {confidence === 'STALE' && <Badge tone="warning">{s('status.stale', 'Confirming live stock')}</Badge>}
    </div>
  )
}

export interface ProductCardData {
  id?: string
  productId?: string
  slug: string
  name: string
  emoji: string
  price: number
  mrp?: number
  rating: number
  image?: string
  brand?: string
  storesNearby?: number
  unitsNearby?: number
  closestKm?: number | null
  fastestMins?: number | null
  pickupToday?: boolean
  openNow?: boolean
  bestStoreName?: string
  confidence?: string
}

export function ProductCard({ product, href }: { product: ProductCardData; href?: string }) {
  const link = href ?? `/products/${product.slug}`
  const img = product.image ?? `/images/products/${product.slug}.jpg`
  return (
    <Link
      href={link}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-shadow hover:shadow-pop"
    >
      <div className="relative aspect-square bg-canvas">
        <Image
          src={img}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          className="object-contain p-4 transition-transform group-hover:scale-[1.03]"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement
            el.style.visibility = 'hidden'
            const parent = el.parentElement
            if (parent && !parent.querySelector('.emoji-fallback')) {
              const span = document.createElement('span')
              span.className = 'emoji-fallback absolute inset-0 flex items-center justify-center text-6xl'
              span.textContent = product.emoji || '🛍️'
              parent.appendChild(span)
            }
          }}
        />
        {product.pickupToday && (
          <span className="absolute left-2 top-2 rounded-full bg-reserve px-2 py-0.5 text-[11px] font-bold text-white">
            ⚡ {s('status.pickupToday', 'Pickup today')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{product.brand}</span>}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink">{product.name}</h3>
        <Stars rating={product.rating} />
        <PriceBlock price={product.price} mrp={product.mrp} size="sm" />
        {product.storesNearby !== undefined && (
          <p className="mt-auto pt-1 text-xs font-semibold text-success-600">
            ✓ {s('product.availableNearby', 'Available nearby')}
            {product.bestStoreName ? ` · ${product.bestStoreName}` : ''}
          </p>
        )}
      </div>
    </Link>
  )
}

export function QuantityStepper({ qty, onChange, min = 1, max = 99 }: { qty: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex h-10 items-center rounded-card border border-border bg-card">
      <button type="button" aria-label="Decrease quantity" className="h-full w-10 text-lg font-bold text-ink-secondary hover:bg-canvas disabled:opacity-40" disabled={qty <= min} onClick={() => onChange(Math.max(min, qty - 1))}>−</button>
      <span className="w-10 text-center text-sm font-bold text-ink" aria-live="polite">{qty}</span>
      <button type="button" aria-label="Increase quantity" className="h-full w-10 text-lg font-bold text-ink-secondary hover:bg-canvas disabled:opacity-40" disabled={qty >= max} onClick={() => onChange(Math.min(max, qty + 1))}>+</button>
    </div>
  )
}
