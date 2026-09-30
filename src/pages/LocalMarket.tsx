import { useNavigate } from 'react-router-dom'
import { MISSING_NEARBY } from '../data/catalog'
import { useCatalog } from '../store/CatalogContext'
import { listingsForStore, storeDistance } from '../lib/geo'
import { formatKm } from '../lib/format'
import { ProductCard, StoreCard } from '../components/commerce'
import { Button, SectionHeading, StatusBadge } from '../components/ui'

const MARKET_SECTIONS = [
  { id: 'stores', label: '🏪 Stores Nearby' },
  { id: 'local', label: '🧺 Local Products' },
  { id: 'handmade', label: '🎨 Handmade' },
  { id: 'home', label: '👨‍🍳 Home Businesses' },
  { id: 'farmers', label: '🌱 Farmers / Producers' },
  { id: 'brands', label: '🎁 Local Brands' },
]

export default function LocalMarket() {
  const navigate = useNavigate()
  const { stores, status } = useCatalog()
  if (status !== 'ready')
    return (
      <div className="nb-container py-16 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )
  const makers = stores.filter((s) => s.localMaker)
  const makerProducts = makers.flatMap((s) => listingsForStore(s.id)).map((l) => l.productId)

  return (
    <div className="space-y-0">
      {/* hero */}
      <div className="relative h-64 lg:h-80 overflow-hidden">
        <img src="/images/local-market.jpg" alt="Local makers market in Dwarka" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-neutral-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 nb-container-wide pb-8">
          <p className="text-caption font-bold uppercase tracking-widest text-amber-200">Local Market</p>
          <h1 className="text-m-hero lg:text-display-md text-white mt-1">What's being made around you</h1>
          <p className="text-m-body text-neutral-200 mt-1">
            Home businesses, artisans and local brands from Dwarka — the marketplace that isn't a mall.
          </p>
        </div>
      </div>

      <div className="nb-container-wide py-10 space-y-12">
        <div className="flex gap-2 nb-scroll-x pb-1">
          {MARKET_SECTIONS.map((s, i) => (
            <span
              key={s.id}
              className={`px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap flex items-center ${
                i === 0 ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>

        <section>
          <SectionHeading title="🎨 Handmade & Home Businesses" sub="Makers you can actually meet at the weekend haat." />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {makerProducts.map((id) => (
              <ProductCard key={id} productId={id} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading title="Local maker storefronts" sub="Store without a website — NearBuy is their digital presence." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(makers.length ? makers : stores).map((s) => (
              <StoreCard key={s.id} storeId={s.id} />
            ))}
          </div>
        </section>

        {/* what's missing near me */}
        <section className="nb-card p-6 lg:p-8 border-warning-200 bg-warning-50/40">
          <SectionHeading
            title="🔍 What's Missing Near Me?"
            sub="Products people nearby are looking for but local stores often don't stock."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {MISSING_NEARBY.map((m) => (
              <div key={m.name} className="bg-white rounded-xl border border-warning-200 p-4">
                <p className="text-body font-semibold text-neutral-900">{m.name}</p>
                <p className="text-body-sm text-neutral-500 mt-1">{m.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="md" onClick={() => navigate('/join/seller')}>
              Stock it — become a seller
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate('/nearby')}>
              Explore nearby demand
            </Button>
          </div>
          <p className="text-caption text-neutral-400 mt-3">
            Demand signals are aggregated and anonymised.
          </p>
        </section>

        <section>
          <SectionHeading title="🏪 Nearby now at the haat" sub="Dilli Handmade Collective · Sector 23" />
          <div className="nb-card p-5 flex flex-wrap items-center gap-4">
            <StatusBadge kind="low">🎨 Weekend haat · 10 AM – 7 PM</StatusBadge>
            <StatusBadge kind="stock">✓ {makerProducts.length} local products live</StatusBadge>
            <StatusBadge kind="ready">📦 Reserve & pickup</StatusBadge>
            <Button
              variant="soft"
              size="md"
              className="ml-auto"
              onClick={() => navigate('/store/s8')}
            >
              Visit store →
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
