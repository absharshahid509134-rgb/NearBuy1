'use client'
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useSearch } from '@nearbuy/api'
import { ProductCard, FoundNearbyChip, Button, Badge, Card, EmptyState, ErrorBlock, LoadingBlock, s, Select, Label, Input } from '@nearbuy/ui'

const SORTS = [
  ['recommended', 'sort.recommended', 'Recommended'],
  ['price_asc', 'sort.priceLowHigh', 'Price: Low to High'],
  ['price_desc', 'sort.priceHighLow', 'Price: High to Low'],
  ['rating', 'sort.rating', 'Rating'],
  ['distance', 'sort.distance', 'Distance'],
  ['fastest', 'sort.fastest', 'Fastest delivery'],
  ['newest', 'sort.newest', 'Newest'],
  ['discount', 'sort.discount', 'Discount'],
] as const

export function SearchView({ initialQuery, initialSort }: { initialQuery: string; initialSort: string }) {
  const params = useSearchParams()
  const [sort, setSort] = React.useState(initialSort)
  const [radiusKm, setRadius] = React.useState(5)
  const [openNow, setOpenNow] = React.useState(false)
  const [pickupToday, setPickup] = React.useState(false)
  const [fast, setFast] = React.useState(params.get('fast') === 'true')
  const [maxPrice, setMaxPrice] = React.useState<number | undefined>(undefined)
  const { data, isLoading, error, refetch, isFetching } = useSearch({
    q: initialQuery, sort, radiusKm, openNow, pickupToday, fast, maxPrice,
    category: params.get('category') ?? undefined,
    take: 24,
  })

  const hits = data?.hits ?? []
  const parsed = data?.parsed

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* FILTER RAIL */}
      <aside className="w-full shrink-0 lg:w-64" aria-label={s('search.filters', 'Filters')}>
        <Card className="sticky top-28 flex flex-col gap-4 p-4">
          <p className="text-sm font-extrabold uppercase tracking-wide text-ink">{s('search.filters', 'Filters')}</p>
          <div>
            <Label htmlFor="radius">{s('search.radius', 'Radius')} ({radiusKm} km)</Label>
            <input id="radius" type="range" min={1} max={15} value={radiusKm} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label htmlFor="maxp">{s('search.maxPrice', 'Max price')}</Label>
            <Input id="maxp" type="number" min={0} placeholder="₹" onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
            <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            {s('search.openNow', 'Open now')}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
            <input type="checkbox" checked={pickupToday} onChange={(e) => setPickup(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            {s('search.pickupToday', 'Pickup today')}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            ⚡ {s('search.fast', 'Fast delivery')}
          </label>
          {parsed && parsed.chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.chips.map((c) => <Badge key={c} tone="accent">{c}</Badge>)}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {s('search.apply', 'Apply filters')}
          </Button>
        </Card>
      </aside>

      {/* RESULTS */}
      <section className="flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {isLoading ? s('common.loading', 'Loading…') : `${hits.length} ${s('search.results', 'results')}`}
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="mb-0">{s('search.sortBy', 'Sort by')}</Label>
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([v, key, label]) => <option key={v} value={v}>{s(key, label)}</option>)}
            </Select>
          </div>
        </div>

        {isLoading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} retry={() => void refetch()} />}
        {!isLoading && !error && hits.length === 0 && (
          <EmptyState title={s('search.empty', 'Nothing nearby yet')} hint={s('search.emptyHint', 'Try a wider radius or a different spelling — or search what a local store might call it.')} />
        )}

        {hits.length > 0 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {hits.map((h) => (
                <div key={h.productId} className="flex flex-col gap-1.5">
                  <ProductCard product={{ ...h, id: h.productId, bestStoreName: undefined }} />
                  <FoundNearbyChip stores={h.storesNearby} units={h.unitsNearby} closestKm={h.closestKm} fastestMins={h.fastestMins} confidence="LIVE" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default SearchView
