import { Link } from 'react-router-dom'
import { bestLocalPrice, getProduct, getStore, storeDistance } from '../lib/geo'
import { formatINR, formatKm } from '../lib/format'
import { ProductVisual } from '../components/commerce'
import { SectionHeading, StatusBadge } from '../components/ui'
import { useCatalog } from '../store/CatalogContext'

const SECTIONS = [
  { id: 'cheapest', title: '💰 Cheapest Nearby', kinds: ['cheapest'] },
  { id: 'fast', title: '⚡ Fast Deals', kinds: ['fast', 'limited'] },
  { id: 'local', title: '🏪 Local Store Offers', kinds: ['local'] },
  { id: 'bundle', title: '📦 Bundle Deals', kinds: ['bundle'] },
  { id: 'coupon', title: '🎟️ Coupons', kinds: ['coupon'] },
]

export default function Deals() {
  const { products, offers, status } = useCatalog()
  if (status !== 'ready')
    return (
      <div className="nb-container py-16 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )
  // "Save ₹180 by buying this from a store 1.6 km away" — computed from real listings
  const smarter = products.map((p) => {
    const best = bestLocalPrice(p.id)
    if (!best || !p.online) return null
    const savings = p.online.price - best.price
    return savings > 0 ? { p, best, savings, online: p.online } : null
  }).filter(Boolean) as {
    p: (typeof products)[number]
    best: { store: { name: string }; distance: number; price: number }
    savings: number
    online: { price: number }
  }[]

  return (
    <div className="nb-container py-6 lg:py-10 space-y-10">
      <div>
        <h1 className="text-m-h1 lg:text-h1">Deals</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          Location-aware savings — not just “20% OFF”, but exactly where and why.
        </p>
      </div>

      {/* signature smarter deals */}
      <section>
        <SectionHeading title="Smarter than a coupon" sub="Savings computed against online prices and real nearby stock." />
        <div className="space-y-3">
          {smarter.slice(0, 4).map(({ p, best, savings }) => (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              className="nb-card p-4 flex flex-wrap items-center gap-4 hover:shadow-medium transition-shadow duration-normal min-h-touch"
            >
              <ProductVisual product={p} className="w-16 h-16 aspect-none rounded-lg" />
              <div className="flex-1 min-w-[220px]">
                <p className="text-body font-semibold text-neutral-900">{p.name}</p>
                <p className="text-body-sm text-neutral-500 mt-0.5">
                  Save <strong className="text-success-600">₹{savings}</strong> by buying from {best.store.name}{' '}
                  {formatKm(best.distance)} away · {formatINR(best.price)}
                </p>
              </div>
              <StatusBadge kind="out">💰 Save ₹{savings}</StatusBadge>
            </Link>
          ))}
        </div>
      </section>

      {/* offer sections */}
      {SECTIONS.map((sec) => {
        const secOffers = offers.filter((o) => sec.kinds.includes(o.kind))
        if (!secOffers.length) return null
        return (
          <section key={sec.id}>
            <SectionHeading title={sec.title} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secOffers.map((o) => (
                <Link
                  key={o.id}
                  to={o.productId ? `/product/${o.productId}` : '/search'}
                  className="nb-card p-5 hover:shadow-medium transition-shadow duration-normal"
                >
                  <StatusBadge kind="out">💰 Save ₹{o.savings}</StatusBadge>
                  <p className="text-body font-semibold text-neutral-900 mt-3">{o.title}</p>
                  <p className="text-body-sm text-neutral-500 mt-1">{o.detail}</p>
                  <div className="flex items-center justify-between mt-3">
                    {o.endsIn ? (
                      <span className="text-caption text-warning-700 font-semibold">⏳ {o.endsIn}</span>
                    ) : (
                      <span className="text-caption text-neutral-400">Ongoing</span>
                    )}
                    {o.storeId && (
                      <span className="text-caption text-neutral-500">🏪 {getStore(o.storeId).name}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
