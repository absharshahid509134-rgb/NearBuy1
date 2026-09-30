import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { getProduct, getStore, storeDistance } from '../lib/geo'
import { formatINR, formatKm } from '../lib/format'
import { NearbyMap, ProductVisual } from '../components/commerce'
import { Button, EmptyState, SectionHeading, StatusBadge } from '../components/ui'
import { useApp } from '../store/AppContext'

/** Multi-store cart with Basket Optimizer + One Trip mode. */
export default function Cart() {
  const navigate = useNavigate()
  const { cart, setQty, removeFromCart, cartTotal, clearCart } = useApp()
  const [optimizer, setOptimizer] = useState<'cost' | 'speed' | 'stops'>('cost')
  const [oneTrip, setOneTrip] = useState(false)

  const groups = useMemo(() => {
    const map = new Map<string, typeof cart>()
    cart.forEach((l) => {
      const arr = map.get(l.storeId) ?? []
      arr.push(l)
      map.set(l.storeId, arr)
    })
    return [...map.entries()].map(([storeId, lines]) => ({
      store: getStore(storeId),
      lines,
      subtotal: lines.reduce((s, l) => s + l.price * l.qty, 0),
    }))
  }, [cart])

  const deliveryTotal = groups.reduce((s, g) => s + (g.store.localDelivery ? 30 : 0), 0)

  // Basket optimizer math (demo): A = one store, B = two stores, C = online
  const basket = useMemo(() => {
    const oneStorePrice = Math.round(cartTotal * 1.08)
    const twoStorePrice = Math.round(cartTotal * 0.985)
    const onlinePrice = Math.round(cartTotal * 0.94)
    return [
      {
        key: 'A' as const,
        label: 'Option A · One nearby store',
        price: oneStorePrice,
        meta: `${groups[0]?.store.name ?? 'Nearest store'} · fewest stops · pickup today`,
        tag: 'Fewest Stops',
      },
      {
        key: 'B' as const,
        label: 'Option B · Two nearby stores',
        price: twoStorePrice,
        meta: `${Math.max(groups.length, 2)} stores · best local balance`,
        tag: 'Best Convenience',
      },
      {
        key: 'C' as const,
        label: 'Option C · Online',
        price: onlinePrice,
        meta: '3–5 days delivery · lowest sticker price',
        tag: 'Lowest Cost',
      },
    ]
  }, [cartTotal, groups])

  const sortedBasket = [...basket].sort((a, b) =>
    optimizer === 'cost'
      ? a.price - b.price
      : optimizer === 'speed'
        ? a.key === 'B'
          ? -1
          : 1
        : a.key === 'A'
          ? -1
          : 1,
  )

  if (!cart.length) {
    return (
      <div className="nb-container py-12">
        <h1 className="text-m-h1 lg:text-h1 mb-6">Cart</h1>
        <EmptyState
          icon="🛍️"
          title="Your cart is empty"
          body="Find products around you — from online sellers and local stores alike."
          action="Find Nearby"
          onAction={() => navigate('/nearby')}
        />
      </div>
    )
  }

  return (
    <div className="nb-container py-6 lg:py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-m-h1 lg:text-h1">Cart</h1>
        <button className="text-body-sm text-neutral-500 hover:text-error-500 min-h-touch" onClick={() => clearCart()}>
          Clear cart
        </button>
      </div>

      {/* multi-store cart */}
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.store.id} className="nb-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-body font-bold text-neutral-900 flex items-center gap-2">
                🏪 {g.store.name}
                <span className="text-caption font-medium text-neutral-500">{formatKm(storeDistance(g.store))}</span>
              </p>
              <StatusBadge kind={g.store.open ? 'stock' : 'closed'}>
                {g.store.open ? 'Open' : `Opens ${g.store.opensAt}`}
              </StatusBadge>
            </div>
            <div className="divide-y divide-neutral-100">
              {g.lines.map((l) => {
                const p = getProduct(l.productId)
                return (
                  <div key={l.productId} className="flex flex-wrap items-center gap-4 py-3">
                    <Link to={`/product/${p.id}`}>
                      <ProductVisual product={p} className="w-16 h-16 aspect-none rounded-md" />
                    </Link>
                    <div className="flex-1 min-w-[140px]">
                      <Link
                        to={`/product/${p.id}`}
                        className="text-body-sm font-semibold text-neutral-900 hover:text-primary-600 line-clamp-1"
                      >
                        {p.name}
                      </Link>
                      <p className="text-caption text-neutral-500">{formatINR(l.price)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQty(l.productId, l.storeId, l.qty - 1)}
                        className="w-9 h-9 rounded-md border border-neutral-200 flex items-center justify-center min-h-touch"
                        aria-label="Less"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-data font-bold w-6 text-center">{l.qty}</span>
                      <button
                        onClick={() => setQty(l.productId, l.storeId, l.qty + 1)}
                        className="w-9 h-9 rounded-md border border-neutral-200 flex items-center justify-center min-h-touch"
                        aria-label="More"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removeFromCart(l.productId, l.storeId)}
                        className="w-9 h-9 rounded-md text-neutral-400 hover:text-error-500 flex items-center justify-center min-h-touch ml-1"
                        aria-label="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="font-data font-bold w-20 text-right">{formatINR(l.price * l.qty)}</p>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-neutral-100 text-body-sm">
              <span className="text-neutral-500">
                {g.store.localDelivery ? '🛵 Local delivery available · ₹30' : '📦 Pickup only'}
              </span>
              <span className="font-semibold">{formatINR(g.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Basket Optimizer */}
      <section className="nb-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h5 font-bold">🧺 Basket Optimizer</h2>
          <div className="flex gap-2">
            {(
              [
                ['cost', 'Lowest Cost'],
                ['speed', 'Fastest'],
                ['stops', 'Fewest Stops'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setOptimizer(k)}
                className={`px-3.5 h-9 rounded-full text-caption font-semibold min-h-touch ${
                  optimizer === k ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-caption text-neutral-500">
          Ranked by <strong className="text-neutral-700">{optimizer === 'cost' ? 'lowest cost' : optimizer === 'speed' ? 'speed' : 'fewest stops'}</strong> — the criteria is always visible.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {sortedBasket.map((o, i) => (
            <div
              key={o.key}
              className={`rounded-xl border-2 p-4 ${i === 0 ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-body-sm font-semibold text-neutral-900">{o.label}</p>
                {i === 0 && <span className="text-caption font-bold text-primary-600 uppercase">{o.tag}</span>}
              </div>
              <p className="font-data font-extrabold text-h4 mt-2">{formatINR(o.price)}</p>
              <p className="text-caption text-neutral-500 mt-1">{o.meta}</p>
            </div>
          ))}
        </div>
      </section>

      {/* One Trip mode */}
      {groups.length > 1 && (
        <section className="nb-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-h5 font-bold">🗺️ One Trip Mode</h2>
              <p className="text-body-sm text-neutral-500 mt-1">Collect everything from nearby stores in a single outing.</p>
            </div>
            <Button variant={oneTrip ? 'soft' : 'secondary'} size="md" onClick={() => setOneTrip((v) => !v)}>
              {oneTrip ? '✓ One Trip planned' : 'Plan one trip'}
            </Button>
          </div>
          {oneTrip && (
            <div className="animate-slideup space-y-3">
              <NearbyMap stores={groups.map((g) => g.store)} height={240} route />
              <div className="flex flex-wrap gap-2 text-body-sm">
                <span className="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 font-semibold">Start · You</span>
                {groups.map((g, i) => (
                  <span key={g.store.id} className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 font-semibold">
                    ↓ {i + 1}. {g.store.name}
                  </span>
                ))}
                <span className="px-3 py-1.5 rounded-full bg-success-50 text-success-700 font-semibold">↓ Home</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* summary */}
      <section className="nb-card p-6 space-y-3">
        <SectionHeading title="Order summary" />
        <div className="flex justify-between text-body-sm">
          <span className="text-neutral-500">Items ({cart.reduce((s, l) => s + l.qty, 0)})</span>
          <span className="font-data font-semibold">{formatINR(cartTotal)}</span>
        </div>
        <div className="flex justify-between text-body-sm">
          <span className="text-neutral-500">Local delivery (if chosen)</span>
          <span className="font-data font-semibold">{formatINR(deliveryTotal)}</span>
        </div>
        <div className="flex justify-between text-body-sm">
          <span className="text-neutral-500">Pickup</span>
          <span className="font-semibold text-success-600">FREE</span>
        </div>
        <div className="flex justify-between text-h5 pt-2 border-t border-neutral-100">
          <span>Total</span>
          <span className="font-data">{formatINR(cartTotal + deliveryTotal)}</span>
        </div>
        <Button size="xl" className="w-full mt-2" onClick={() => navigate('/checkout')}>
          <ShoppingCart size={20} /> Checkout
        </Button>
        <p className="text-caption text-neutral-400 text-center">
          Delivery, pickup or reserve — decided at checkout per store.
        </p>
      </section>
    </div>
  )
}
