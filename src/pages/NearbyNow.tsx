import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext'
import { getProduct, getStore, storeDistance } from '../lib/geo'
import { formatINR, formatKm } from '../lib/format'
import { Button, StatusBadge, NearbyBadge, FastBadge } from '../components/ui'
import { ProductVisual } from '../components/commerce'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'

type Sort = 'nearest' | 'fastest' | 'cheapest'

/** "NEARBY NOW" — urgent, right-now local commerce. */
export default function NearbyNow() {
  const navigate = useNavigate()
  const [sort, setSort] = useState<Sort>('nearest')
  const [cat, setCat] = useState<string>('all')
  const { addToCart, toast } = useApp()
  const { listings, products, categories, status } = useCatalog()

  const items = useMemo(() => {
    let rows = listings.filter((l) => {
      const s = getStore(l.storeId)
      return l.stock > 0 && s.open && s.pickup
    }).map((l) => {
      const s = getStore(l.storeId)
      const d = storeDistance(s)
      return {
        ...l,
        product: getProduct(l.productId),
        store: s,
        distance: d,
        readyMins: s.prepMins + Math.round(d * 6),
      }
    })
    if (cat !== 'all') rows = rows.filter((r) => r.product.category === cat)
    if (sort === 'cheapest') rows.sort((a, b) => a.price - b.price)
    else if (sort === 'fastest') rows.sort((a, b) => a.readyMins - b.readyMins)
    else rows.sort((a, b) => a.distance - b.distance)
    return rows
  }, [sort, cat, listings])

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div className="rounded-2xl bg-neutral-900 text-white p-6 lg:p-10">
        <p className="text-caption font-bold uppercase tracking-widest text-sky-300">⚡ Signature mode</p>
        <h1 className="text-m-hero lg:text-display-md mt-2">NEARBY NOW</h1>
        <p className="text-m-body lg:text-body-lg text-neutral-300 mt-2">
          Products available right now — open store, in stock, pickup ready.
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-caption font-semibold">🟢 Open</span>
          <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-caption font-semibold">🟢 In Stock</span>
          <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-caption font-semibold">🟢 Pickup Available</span>
        </div>
        <div className="flex gap-2 mt-6">
          {(['nearest', 'fastest', 'cheapest'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-4 h-10 rounded-full text-body-sm font-semibold capitalize min-h-touch transition-colors duration-fast ${
                sort === s ? 'bg-primary-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 nb-scroll-x pb-1">
        <button
          onClick={() => setCat('all')}
          className={`px-3.5 h-9 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch ${
            cat === 'all' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
          }`}
        >
          All
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

      <div className="space-y-3">
        {items.map((r) => (
          <div
            key={r.productId + r.storeId}
            className="nb-card p-4 flex flex-col xs:flex-row gap-4 items-start xs:items-center"
          >
            <Link to={`/product/${r.productId}`} className="shrink-0">
              <ProductVisual product={r.product} className="w-24 h-24 aspect-none rounded-xl" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/product/${r.productId}`} className="text-body font-semibold text-neutral-900 hover:text-primary-600 line-clamp-1">
                {r.product.name}
              </Link>
              <p className="text-[13px] text-neutral-500 mt-0.5">
                🏪 {r.store.name} · {r.store.area}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <NearbyBadge km={r.distance} />
                <FastBadge mins={`${r.readyMins} min`} />
                <StatusBadge kind="stock">✓ {r.stock} in stock</StatusBadge>
              </div>
            </div>
            <div className="flex xs:flex-col items-center xs:items-end gap-2 w-full xs:w-auto">
              <p className="font-data font-bold text-xl">{formatINR(r.price)}</p>
              <div className="flex gap-2 w-full xs:w-auto">
                <Button
                  variant="reserve"
                  size="sm"
                  className="flex-1 xs:flex-none"
                  onClick={() => navigate(`/product/${r.productId}?action=reserve&store=${r.storeId}`)}
                >
                  Reserve
                </Button>
                <Button
                  size="sm"
                  className="flex-1 xs:flex-none"
                  onClick={() => {
                    addToCart({ productId: r.productId, storeId: r.storeId, qty: 1, price: r.price })
                    toast({ kind: 'success', title: 'Added to cart', body: `${r.product.name} · ${r.store.name}` })
                  }}
                >
                  Buy
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
