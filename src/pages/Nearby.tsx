import { useMemo, useState } from 'react'
import { useCatalog } from '../store/CatalogContext'
import { listingsForStore, storeDistance } from '../lib/geo'
import { formatKm } from '../lib/format'
import { NearbyMap, StoreRow } from '../components/commerce'
import { Button, SectionHeading, StatusBadge } from '../components/ui'
import type { Store } from '../data/types'

type FilterKey = 'open' | 'pickup' | 'delivery' | 'verified' | 'offers' | 'under2km'

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: 'open', label: 'Open Now' },
  { id: 'pickup', label: 'Pickup' },
  { id: 'delivery', label: 'Local Delivery' },
  { id: 'verified', label: 'Verified' },
  { id: 'offers', label: 'Offers' },
  { id: 'under2km', label: 'Under 2 km' },
]

export default function Nearby() {
  const { stores, categories, categoryMap, status } = useCatalog()
  const [active, setActive] = useState<Set<FilterKey>>(new Set(['open']))
  const [cat, setCat] = useState<string>('all')
  const [radius, setRadius] = useState(3)
  const [selected, setSelected] = useState<string | undefined>()
  const [sort, setSort] = useState<'distance' | 'rating' | 'price'>('distance')

  const toggle = (k: FilterKey) => {
    const next = new Set(active)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setActive(next)
  }

  const results = useMemo(() => {
    let list = stores.map((s) => ({ s, d: storeDistance(s), listings: listingsForStore(s.id) }))
    list = list.filter(({ s, d }) => {
      if (d > radius) return false
      if (active.has('open') && !s.open) return false
      if (active.has('pickup') && !s.pickup) return false
      if (active.has('delivery') && !s.localDelivery) return false
      if (active.has('verified') && !s.verified) return false
      if (active.has('under2km') && d > 2) return false
      if (active.has('offers') && !s.health.inventoryAccuracy) return false
      if (cat !== 'all' && s.category !== cat) return false
      return true
    })
    if (sort === 'rating') list.sort((a, b) => b.s.rating - a.s.rating)
    else if (sort === 'price') list.sort((a, b) => avgPrice(a.listings) - avgPrice(b.listings))
    else list.sort((a, b) => a.d - b.d)
    return list
  }, [active, cat, radius, sort, stores])

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-m-h1 lg:text-h1">Nearby</h1>
          <p className="text-body-sm text-neutral-500 mt-1">
            {results.length} stores around Dwarka Sector 22 within {radius} km.
          </p>
        </div>
        <div className="flex gap-2">
          {(['distance', 'rating', 'price'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3.5 h-9 rounded-full text-caption font-semibold capitalize min-h-touch ${
                sort === s ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
              }`}
            >
              {s === 'price' ? 'Avg price' : s}
            </button>
          ))}
        </div>
      </div>

      {/* map + list */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="lg:sticky lg:top-24 space-y-3">
          <NearbyMap
            stores={results.map((r) => r.s)}
            selectedId={selected}
            onSelect={setSelected}
            height={380}
          />
          <div className="nb-card p-4 flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <div className="flex-1">
              <p className="text-body-sm font-semibold">Search radius · {radius} km</p>
              <input
                type="range"
                min={1}
                max={6}
                value={radius}
                onChange={(e) => setRadius(+e.target.value)}
                className="w-full mt-1 accent-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* filters */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`px-3.5 h-9 rounded-full text-body-sm font-semibold transition-colors duration-fast min-h-touch ${
                  active.has(f.id)
                    ? 'bg-primary-50 text-primary-600 border border-primary-200'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {active.has(f.id) ? '✓ ' : ''}
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 nb-scroll-x pb-1">
            <button
              onClick={() => setCat('all')}
              className={`px-3.5 h-9 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch ${
                cat === 'all' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`px-3.5 h-9 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch ${
                  cat === c.id ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
                }`}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>

          {/* store list */}
          <div className="space-y-3">
            {results.map(({ s, d, listings }) => (
              <div key={s.id} className="space-y-2">
                <div
                  onMouseEnter={() => setSelected(s.id)}
                  className={`rounded-xl transition-shadow duration-normal ${
                    selected === s.id ? 'ring-2 ring-primary-500 shadow-medium' : ''
                  }`}
                >
                  <StoreRow storeId={s.id} />
                </div>
                {selected === s.id && (
                  <div className="nb-card p-4 animate-slideup">
                    <p className="text-caption font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      Sample shelves · {listings.length} products
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listings.slice(0, 6).map((l) => (
                        <span
                          key={l.productId}
                          className="px-2.5 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-caption text-neutral-600"
                        >
                          {l.product.emoji} {l.product.name.split(' ').slice(0, 2).join(' ')} · ₹{l.price}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {s.pickup && <StatusBadge kind="ready">📦 Pickup ready in {s.prepMins} min</StatusBadge>}
                      {s.localDelivery && <StatusBadge kind="stock">🛵 Deliver in ~{35 + Math.round(d * 8)} min</StatusBadge>}
                      <StatusBadge kind="closed">📍 {formatKm(d)}</StatusBadge>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!results.length && (
              <div className="nb-card p-10 text-center">
                <p className="text-4xl mb-3">🗺️</p>
                <p className="text-h5 font-bold">No stores found nearby</p>
                <p className="text-body-sm text-neutral-500 mt-1">
                  Try increasing your search radius or choosing another category.
                </p>
                <Button className="mt-4" size="md" onClick={() => { setRadius(6); setActive(new Set()); setCat('all') }}>
                  Change Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function avgPrice(listings: { price: number }[]): number {
  if (!listings.length) return 99999
  return listings.reduce((s, l) => s + l.price, 0) / listings.length
}
