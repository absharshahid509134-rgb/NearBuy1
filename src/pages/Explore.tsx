import { useNavigate } from 'react-router-dom'
import { EVENTS } from '../data/catalog'
import { useCatalog } from '../store/CatalogContext'
import { COLLECTION_DEFS } from '../lib/collections'
import { getProduct, storeDistance } from '../lib/geo'
import { ProductCard, CategoryTile, StoreRow } from '../components/commerce'
import { SectionHeading, StatusBadge } from '../components/ui'
import { formatKm } from '../lib/format'

export default function Explore() {
  const navigate = useNavigate()
  const { stores, products, categories, offers, status } = useCatalog()
  const newArrivals = [...products].reverse().slice(0, 6).map((p) => p.id)
  const trending = [...products].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 6).map((p) => p.id)
  const brands = [...new Set(products.map((p) => p.brand).filter((b) => b && b !== 'Local'))].slice(0, 10)
  if (status !== 'ready')
    return (
      <div className="nb-container py-16 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )

  return (
    <div className="nb-container py-6 lg:py-10 space-y-12">
      <div>
        <h1 className="text-m-h1 lg:text-h1">Explore</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          Categories, brands, local stores and what's trending around Dwarka.
        </p>
      </div>

      <section>
        <SectionHeading title="Categories" sub="Everything local stores keep on their shelves." />
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((c) => (
            <CategoryTile key={c.id} categoryId={c.id} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Collections" sub="Seasonal picks curated for your area." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLLECTION_DEFS.map((d) => { const c = { ...d, productIds: products.filter((p) => d.categories.includes(p.category)).slice(0, 4).map((p) => p.id) }; if (!c.productIds.length) return null; return (
            <button
              key={c.id}
              onClick={() => navigate(`/search?collection=${c.id}`)}
              className="rounded-xl p-6 text-left border border-neutral-200 hover:shadow-medium transition-shadow duration-normal min-h-[140px]"
              style={{ background: c.tint }}
            >
              <span className="text-4xl">{c.emoji}</span>
              <p className="text-h5 font-bold text-neutral-900 mt-3">{c.name}</p>
              <p className="text-body-sm text-neutral-500 mt-1">{c.blurb}</p>
              <div className="flex gap-1 mt-3">
                {c.productIds.slice(0, 3).map((id) => (
                  <span key={id} className="text-2xl">
                    {getProduct(id).emoji}
                  </span>
                ))}
              </div>
            </button>
          ); })}
        </div>
      </section>

      <section>
        <SectionHeading title="Event Mode" sub="Planning something? NearBuy builds the procurement plan." action="Try Event Mode" onAction={() => navigate('/nearai')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {EVENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/nearai?q=${encodeURIComponent(`Event: ${e.name} — ${e.sample}`)}`)}
              className="nb-card p-5 text-left hover:shadow-medium transition-shadow duration-normal min-h-touch"
            >
              <span className="text-3xl">{e.emoji}</span>
              <p className="text-body font-bold mt-2">{e.name}</p>
              <p className="text-caption text-neutral-500 mt-1">{e.sample}</p>
              <p className="text-caption font-semibold text-primary-600 mt-2">
                Budget ~₹{e.budget.toLocaleString('en-IN')} → get a plan
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Trending in Dwarka" sub="Popular nearby this week." />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {trending.map((id) => (
            <ProductCard key={id} productId={id} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="New Arrivals" sub="Freshly added by stores around you." />
        <div className="nb-scroll-x flex gap-4 pb-2">
          {newArrivals.map((id) => (
            <div key={id} className="w-[230px] shrink-0">
              <ProductCard productId={id} compact />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Brands" />
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => navigate(`/search?q=${b}`)}
              className="px-4 h-11 rounded-full bg-white border border-neutral-200 text-body-sm font-semibold text-neutral-700 hover:border-primary-300 hover:text-primary-600 transition-colors duration-fast min-h-touch"
            >
              {b}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Local Stores" sub="Discover shops worth following." action="See all" onAction={() => navigate('/stores')} />
        <div className="space-y-3">
          {[...stores]
            .sort((a, b) => storeDistance(a) - storeDistance(b))
            .slice(0, 4)
            .map((s) => (
              <StoreRow key={s.id} storeId={s.id} />
            ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Deals" sub="Location-aware savings." action="All deals" onAction={() => navigate('/deals')} />
        <div className="grid sm:grid-cols-2 gap-4">
          {offers.slice(0, 2).map((o) => (
            <div key={o.id} className="nb-card p-5">
              <StatusBadge kind="out">💰 Save ₹{o.savings}</StatusBadge>
              <p className="text-body font-semibold mt-3">{o.title}</p>
              <p className="text-body-sm text-neutral-500 mt-1">{o.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
