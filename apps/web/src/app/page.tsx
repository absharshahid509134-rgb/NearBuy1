import Link from 'next/link'
import Image from 'next/image'
import { apiServer } from '@/lib/server-api'
import { ProductCard, SectionHeader, s, formatINR, Badge, Card, SearchBar } from '@nearbuy/ui'
import type { SearchHit, SearchResponse, StoreNearbyRow, ProductRow } from '@nearbuy/api'

const QUICK_ACTIONS = [
  { href: '/search?q=deals&fast=true', icon: '⚡', key: 'action.minutes', label: 'Minutes' },
  { href: '/search?fulfillment=RESERVE_AND_PICKUP', icon: '🏪', key: 'action.nearbyDeals', label: 'Nearby Deals' },
  { href: '/search?fulfillment=PICKUP', icon: '📍', key: 'action.pickup', label: 'Pickup Nearby' },
  { href: '/search?fulfillment=STANDARD', icon: '🚚', key: 'action.delivery', label: 'Delivery' },
  { href: '/help', icon: '🛠️', key: 'action.services', label: 'Services' },
  { href: '/search?q=gift', icon: '🎁', key: 'action.gifts', label: 'Gifts' },
  { href: '/search?q=exchange', icon: '♻️', key: 'action.exchange', label: 'Exchange' },
  { href: '/search?q=flight', icon: '✈️', key: 'action.flights', label: 'Flights' },
]

const CATEGORIES = [
  { slug: 'mobiles-accessories', name: 'Mobiles & Accessories', emoji: '📱' },
  { slug: 'fashion', name: 'Fashion', emoji: '👕' },
  { slug: 'home-kitchen', name: 'Home & Kitchen', emoji: '🏠' },
  { slug: 'beauty-health', name: 'Beauty & Health', emoji: '🧴' },
  { slug: 'sports-fitness', name: 'Sports & Fitness', emoji: '🏏' },
  { slug: 'books-stationery', name: 'Books & Stationery', emoji: '📚' },
]

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [hitSearch, catalog, stores] = await Promise.all([
    apiServer<SearchResponse>('/search?query=a&lat=28.5921&lng=77.046&radiusKm=5&take=12'),
    apiServer<ProductRow[]>('/products?take=24'),
    apiServer<StoreNearbyRow[]>('/stores/nearby?lat=28.5921&lng=77.046&take=6'),
  ])

  const hits: SearchHit[] = hitSearch?.hits ?? []
  const products: ProductRow[] = catalog ?? []
  const nearbyPickup = hits.filter((h) => h.unitsNearby > 0 && h.pickupToday).slice(0, 6)

  return (
    <div className="pb-10">
      {/* HERO */}
      <section className="relative overflow-hidden bg-primary-600 text-white">
        <div className="nb-container flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:py-14">
          <div className="flex-1">
            <Badge tone="accent" className="bg-accent-400 text-ink border-accent-400">📍 {s('location.badge', 'Dwarka Sector 22, Delhi')}</Badge>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight lg:text-5xl">{s('hero.title', 'What You Need, Already Nearby.')}</h1>
            <p className="mt-2 max-w-xl text-lg text-primary-100">{s('hero.subtitle', 'Search Online. Find Nearby. Reserve. Pickup. Deliver.')}</p>
            <div className="mt-5 max-w-xl rounded-card bg-white p-2">
              <SearchBar />
            </div>
          </div>
          <div className="relative hidden h-64 w-96 overflow-hidden rounded-card shadow-pop lg:block">
            <Image src="/images/local-market.jpg" alt={s('alt.localMarket', 'Local market street')} fill className="object-cover" sizes="384px" priority />
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="nb-container -mt-6">
        <Card className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-8">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 rounded-card py-2 text-center hover:bg-canvas">
              <span aria-hidden className="text-3xl">{a.icon}</span>
              <span className="text-xs font-bold text-ink-secondary">{s(a.key, a.label)}</span>
            </Link>
          ))}
        </Card>
      </section>

      {/* CATALOG */}
      {products.length > 0 && (
        <section className="nb-container mt-10">
          <SectionHeader title={s('home.deals', 'Deals near you')} action={<Link href="/search" className="text-sm font-bold text-primary-600">{s('common.viewAll', 'View all')} →</Link>} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {hits.slice(6, 12).map((h) => (
              <ProductCard key={'c' + h.productId} product={{ ...h, id: h.productId, bestStoreName: undefined }} />
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="nb-container mt-10">
        <SectionHeader title={s('home.categories', 'Shop by category')} />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 rounded-card border border-border bg-card p-4 shadow-card hover:border-primary-300">
              <span aria-hidden className="text-4xl">{c.emoji}</span>
              <span className="text-center text-sm font-semibold text-ink">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* PICKUP TODAY rail */}
      {nearbyPickup.length > 0 && (
        <section className="nb-container mt-10">
          <SectionHeader
            title={s('home.pickupToday', 'Ready for pickup — reserve now')}
            action={<Link href="/search?fulfillment=RESERVE_AND_PICKUP" className="text-sm font-bold text-primary-600">{s('common.viewAll', 'View all')} →</Link>}
          />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {nearbyPickup.map((h) => (
              <div key={h.productId} className="w-[220px] shrink-0">
                <ProductCard product={{ ...h, id: h.productId, bestStoreName: undefined }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOUND NEARBY */}
      {hits.length > 0 && (
        <section className="nb-container mt-10">
          <SectionHeader title={s('foundNearby.title', 'FOUND NEARBY')} action={<Link href="/search" className="text-sm font-bold text-primary-600">{s('common.viewAll', 'View all')} →</Link>} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {hits.slice(0, 6).map((h) => (
              <ProductCard key={h.productId} product={{ ...h, id: h.productId, bestStoreName: undefined }} />
            ))}
          </div>
        </section>
      )}

      {/* LOCAL STORES */}
      {stores && stores.length > 0 && (
        <section className="nb-container mt-10">
          <SectionHeader title={s('home.localStores', 'Local stores near you')} action={<Link href="/stores" className="text-sm font-bold text-primary-600">{s('common.viewAll', 'View all')} →</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.slice(0, 6).map((store) => (
              <Link key={store.id} href={`/stores/${store.slug}`} className="flex gap-3 rounded-card border border-border bg-card p-4 shadow-card hover:border-primary-300">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-canvas text-5xl">{store.emoji}</div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{store.name}</p>
                  <p className="text-sm text-ink-secondary">{store.area} · {store.category}</p>
                  <p className="text-xs font-semibold text-success-600">
                    {s('status.inStock', 'In stock')}: {store.inStockProducts} · 📍 {store.distanceKm} km · {store.travelMins} min
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* VALUE STRIP */}
      <section className="nb-container mt-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: '📍', title: s('value.localTitle', 'Real nearby inventory'), text: s('value.localText', 'See live stock at shops around you — not a distant warehouse.') },
            { icon: '⚡', title: s('value.reserveTitle', 'Reserve in seconds'), text: s('value.reserveText', 'NB-#### pickup code + QR. In and out in minutes.') },
            { icon: '🔄', title: s('value.returnTitle', 'Easy returns & refunds'), text: s('value.returnText', 'Eligibility → pickup → inspection → refund, fully tracked.') },
          ].map((v) => (
            <Card key={v.title} className="p-5">
              <p aria-hidden className="text-3xl">{v.icon}</p>
              <p className="mt-2 font-bold text-ink">{v.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{v.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
