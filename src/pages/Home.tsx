import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Zap } from 'lucide-react'
import { CUSTOMER_LOCATION } from '../data/catalog'
import {
  bestLocalPrice,
  closestListing,
  foundNearby,
  getProduct,
  listingsForProduct,
  storeDistance,
} from '../lib/geo'
import { formatINR, formatKm } from '../lib/format'
import { CategoryTile, NearbyMap, ProductCard, SearchBar, StoreRow } from '../components/commerce'
import { iconForProduct } from '../components/visuals'
import { Button, SectionHeading, StatusBadge } from '../components/ui'
import { useState } from 'react'
import { useCatalog } from '../store/CatalogContext'
import { COLLECTION_DEFS } from '../lib/collections'
import { useAuth } from '../auth/AuthContext'
import { MapPin, PackageCheck } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const { stores, products, categories, offers, status } = useCatalog()

  if (status !== 'ready')
    return (
      <div className="nb-container py-24 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )

  // Aliveness signal — grounded in live persisted inventory
  const heroProduct = products.find((p) => foundNearby(p.id).stores > 0) ?? products[0]
  const dynamicMsg = heroProduct
    ? (() => {
        const f = foundNearby(heroProduct.id)
        return `${f.stores} store${f.stores === 1 ? '' : 's'} nearby have ${heroProduct.name.split('—')[0].trim()} in stock.`
      })()
    : 'Local stores are stocking up around you.'

  const availableNear = products
    .map((p) => ({ id: p.id, f: foundNearby(p.id) }))
    .filter((x) => x.f.stores > 0)
    .slice(0, 8)
    .map((x) => x.id)

  const betterPrices = products
    .map((p) => {
      const best = bestLocalPrice(p.id)
      if (!best) return null
      const onlinePrice = p.online?.price ?? p.mrp
      const savings = onlinePrice - best.price
      return savings > 0 ? { id: p.id, savings, best, onlinePrice } : null
    })
    .filter(Boolean)
    .slice(0, 4) as {
    id: string
    savings: number
    best: { store: { id: string; name: string }; distance: number; price: number }
    onlinePrice: number
  }[]

  const storesNear = [...stores]
    .map((s) => ({ s, d: storeDistance(s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)

  const fastPicks = products
    .map((p) => ({ id: p.id, f: foundNearby(p.id) }))
    .filter((x) => x.f.fastestMins !== null && x.f.fastestMins < 20)
    .slice(0, 8)
    .map((x) => x.id)

  const quickBuy = products
    .map((p) => ({ id: p.id, f: foundNearby(p.id) }))
    .filter((x) => x.f.stores > 0)
    .slice(0, 8)
    .map((x) => x.id)

  const collections = COLLECTION_DEFS.map((d) => ({
    ...d,
    productIds: products.filter((p) => d.categories.includes(p.category)).slice(0, 4).map((p) => p.id),
  })).filter((c) => c.productIds.length)

  return (
    <div>
      {/* A customer-only storefront, separate from the other workspaces. */}
      <section className="customer-hero">
        <div className="nb-container-wide customer-hero-inner">
          <div className="customer-hero-copy">
            <p className="customer-hero-eyebrow">
              <span className="customer-hero-spark">✦</span> YOUR LOCAL MARKETPLACE
            </p>
            <h1>
              Good things are <span>closer</span> than you think.
            </h1>
            <p className="customer-hero-lede">
              Hello, {user?.name.split(' ')[0] || 'neighbour'}. Find the things you need at the stores around
              you. Compare your options, then choose pickup, reservation or delivery.
            </p>
            <div className="customer-hero-search">
              <SearchBar
                value={q}
                onChange={setQ}
                onSubmit={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
              />
            </div>
            <div className="customer-hero-actions">
              <Button size="lg" onClick={() => navigate('/nearby')}>
                <MapPin size={18} /> Shop nearby
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/nearby-now')}>
                ⚡ Available now
              </Button>
              <Button size="lg" variant="soft" onClick={() => navigate('/nearai')}>
                ✦ Ask NearAI
              </Button>
            </div>
            <div className="customer-hero-signal">
              <span /> {dynamicMsg}
            </div>
          </div>
          <div className="customer-hero-photo">
            <img src="/images/hero.jpg" alt="Handmade goods at a local neighbourhood market" />
            <div className="customer-hero-photo-gradient" />
            <div className="customer-hero-photo-caption">
              <p>MORE THAN A MARKETPLACE</p>
              <strong>
                Find the good stuff
                <br />
                around you.
              </strong>
            </div>
            <div className="customer-hero-photo-float">
              <PackageCheck size={20} />
              <div>
                <strong>Shop the neighbourhood</strong>
                <span>Discover · compare · collect</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="nb-container-wide py-10 lg:py-16 space-y-12 lg:space-y-16">
        {/* ── Categories ───────────────────────────────── */}
        <section>
          <SectionHeading
            title="What do you need today?"
            sub="Browse by category"
            action="Explore all"
            onAction={() => navigate('/explore')}
          />
          <div className="nb-scroll-x flex gap-4 sm:grid sm:grid-cols-4 lg:grid-cols-8 pb-2">
            {categories.map((c) => (
              <CategoryTile key={c.id} categoryId={c.id} />
            ))}
          </div>
        </section>

        {/* ── Available near you ───────────────────────── */}
        <section>
          <SectionHeading
            title="Available Near You"
            sub="Products currently available around your location."
            action="See all"
            onAction={() => navigate('/search?mode=nearby')}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {availableNear.slice(0, 4).map((id) => (
              <ProductCard key={id} productId={id} />
            ))}
          </div>
        </section>

        {/* ── Stores around you ────────────────────────── */}
        <section>
          <SectionHeading
            title="Stores Around You"
            sub="Real shelves, real stock — within walking and riding distance."
            action="See all"
            onAction={() => navigate('/stores')}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {storesNear.map(({ s }) => (
              <StoreRow key={s.id} storeId={s.id} />
            ))}
          </div>
        </section>

        {/* ── Get it fast ──────────────────────────────── */}
        <section>
          <SectionHeading
            title="Get It Fast"
            sub="Ready for pickup in under 20 minutes."
            action="Nearby Now"
            onAction={() => navigate('/nearby-now')}
          />
          <div className="nb-scroll-x flex gap-4 pb-2">
            {fastPicks.map((id) => {
              const f = foundNearby(id)
              return (
                <div key={id} className="w-[240px] shrink-0">
                  <ProductCard productId={id} compact />
                  <div className="mt-2 flex justify-center">
                    <StatusBadge kind="low">⚡ Pickup in ~{f.fastestMins} min</StatusBadge>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Better prices nearby ─────────────────────── */}
        <section>
          <SectionHeading
            title="Better Prices Nearby"
            sub="Local stores beating online — not just fast, often cheaper."
            action="All deals"
            onAction={() => navigate('/deals')}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {betterPrices.map(({ id, savings, best }) => {
              const product = getProduct(id)
              const Icon = iconForProduct(product)
              return <Link
                key={id}
                to={`/product/${id}`}
                className="nb-card p-4 flex items-center gap-3 hover:shadow-medium transition-shadow duration-normal min-h-touch min-w-0 w-full overflow-hidden"
              >
                <span className="product-row-icon" style={{ color: categories.find(c => c.id === product.category)?.accent }}><Icon size={22} strokeWidth={1.8} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold text-neutral-900 truncate">{product.name}</p>
                  <p className="text-[13px] text-neutral-500 mt-0.5 truncate">
                    {best.store.name} · {formatKm(best.distance)} · {formatINR(best.price)}
                  </p>
                </div>
                <StatusBadge kind="stock">Save ₹{savings}</StatusBadge>
              </Link>
            })}
          </div>
        </section>

        {/* ── Reserve & pickup ─────────────────────────── */}
        <section>
          <SectionHeading
            title="Reserve & Pickup"
            sub="Shop books it and packs it before you arrive."
            action="My reservations"
            onAction={() => navigate('/reservations')}
          />
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              {['p18', 'p2'].map((id) => {
                const l = closestListing(id)
                return (
                  <div key={id} className="relative">
                    <ProductCard productId={id} />
                    {l && (
                      <div className="absolute bottom-2 left-2">
                        <StatusBadge kind="reserved">📦 {l.store.prepMins} min to pack</StatusBadge>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="rounded-xl bg-reservebg border border-reserveborder p-6 flex flex-col justify-center">
              <p className="text-h4 font-bold text-neutral-900">Skip the queue.</p>
              <p className="text-body-sm text-[#6D28D9] mt-2 font-medium">
                Reserve items with one tap — get a QR pickup code, arrive, scan and go.
              </p>
              <ul className="mt-4 space-y-2 text-body-sm text-neutral-700">
                <li>✓ Pickup windows spread the rush</li>
                <li>✓ Hold-for-me for small purchases</li>
                <li>✓ Expiry timers keep shelves moving</li>
              </ul>
              <Button variant="reserve" className="mt-5" onClick={() => navigate('/nearby-now')}>
                Walk-in ready items
              </Button>
            </div>
          </div>
        </section>

        {/* ── Local deals ──────────────────────────────── */}
        <section>
          <SectionHeading
            title="Local Deals"
            sub="Location-aware savings from stores around you."
            action="See all"
            onAction={() => navigate('/deals')}
          />
          <div className="nb-scroll-x flex gap-4 pb-2">
            {offers.slice(0, 4).map((o) => (
              <Link
                key={o.id}
                to={o.productId ? `/product/${o.productId}` : '/deals'}
                className="nb-card p-5 w-[300px] shrink-0 hover:shadow-medium transition-shadow duration-normal"
              >
                <StatusBadge kind="out">💰 Save ₹{o.savings}</StatusBadge>
                <p className="text-body font-semibold text-neutral-900 mt-3">{o.title}</p>
                <p className="text-[13px] text-neutral-500 mt-1 line-clamp-2">{o.detail}</p>
                {o.endsIn && (
                  <p className="text-caption text-warning-700 mt-2 font-semibold">⏳ {o.endsIn}</p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* ── QuickBuy ─────────────────────────────────── */}
        <section>
          <SectionHeading
            title="Buy Again"
            sub="Frequent purchases — tap to check nearby availability right now."
          />
          <div className="nb-scroll-x flex gap-3 pb-2">
            {quickBuy.map((id) => {
              const f = foundNearby(id)
              return (
                <Link
                  key={id}
                  to={`/product/${id}`}
                  className="nb-card px-4 py-3 flex items-center gap-3 min-w-[220px] hover:shadow-medium transition-shadow duration-normal min-h-touch"
                >
                  <span className="text-2xl">{getProduct(id).emoji}</span>
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-neutral-900 truncate">
                      {getProduct(id).name}
                    </p>
                    <p className="text-caption text-success-600 font-semibold">
                      {f.stores > 0 ? `✓ ${f.stores} nearby` : 'Unavailable nearby'}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Ask NearAI ───────────────────────────────── */}
        <section className="nb-card p-8 lg:p-10 bg-gradient-to-r from-neutral-50 to-primary-50 border-primary-100 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-1">
            <h2 className="text-m-h2 lg:text-h2 font-bold flex items-center gap-2">
              🤖 Ask NearAI <Sparkles size={22} className="text-reserve" />
            </h2>
            <p className="text-body text-neutral-600 mt-2 max-w-xl">
              “Where can I get football shoes tonight?” · “Find the cheapest printer nearby” · “I need a
              birthday gift under ₹1,000” — answers grounded in real nearby inventory.
            </p>
          </div>
          <Button size="xl" onClick={() => navigate('/nearai')}>
            Open NearAI <ArrowRight size={20} />
          </Button>
        </section>

        {/* ── Collections teaser ───────────────────────── */}
        <section>
          <SectionHeading
            title="Popular in Your Area"
            sub="Seasonal collections curated for Dwarka."
            action="Explore"
            onAction={() => navigate('/explore')}
          />
          <div className="nb-scroll-x flex gap-4 pb-2">
            {collections.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/search?collection=${c.id}`)}
                className="w-[220px] shrink-0 rounded-xl p-5 text-left hover:shadow-medium transition-shadow duration-normal border border-neutral-200"
                style={{ background: c.tint }}
              >
                <span className="text-3xl">{c.emoji}</span>
                <p className="text-body font-bold text-neutral-900 mt-3">{c.name}</p>
                <p className="text-caption text-neutral-500 mt-1">{c.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Map teaser ───────────────────────────────── */}
        <section>
          <SectionHeading
            title="Your Local Map"
            sub="Stores, stock and pickup points around Dwarka Sector 22."
            action="Open Nearby"
            onAction={() => navigate('/nearby')}
          />
          <NearbyMap stores={stores.slice(0, 6)} height={300} />
        </section>
      </div>
    </div>
  )
}
