import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, ShieldCheck } from 'lucide-react'
import { categoryById } from '../lib/liveCatalog'
import { useCatalog } from '../store/CatalogContext'
import { getStore, listingsForStore, storeDistance } from '../lib/geo'
import { formatKm } from '../lib/format'
import { NearbyMap, ProductCard } from '../components/commerce'
import { Button, StatusBadge, Tabs, VerifiedBadge } from '../components/ui'
import { useApp } from '../store/AppContext'

type Tab = 'products' | 'offers' | 'new' | 'reviews' | 'about'

export default function StorePage() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState<Tab>('products')
  const { followed, toggleFollow, toast } = useApp()
  const { storeReviews, offers: allOffers, status } = useCatalog()
  const listings = useMemo(() => (status === 'ready' ? listingsForStore(id) : []), [id, status])

  const store = getStore(id)
  if (!store) return <div className="nb-container py-20 text-center">Store not found.</div>

  const dist = storeDistance(store)
  const isFollowed = followed.includes(id)
  const reviews = storeReviews[id] ?? []
  const offers = allOffers.filter((o) => o.storeId === id)

  return (
    <div className="space-y-0">
      {/* hero */}
      <div className="h-48 lg:h-64 bg-neutral-100 relative overflow-hidden">
        {store.cover ? (
          <img src={store.cover} alt={store.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-8xl"
            style={{ background: categoryById(store.category)?.tint }}
          >
            {store.emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/50 to-transparent" />
      </div>

      <div className="nb-container -mt-12 relative z-10 pb-10 space-y-6">
        <div className="nb-card p-6 flex flex-wrap items-center gap-5">
          <div
            className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-2xl bg-white border border-neutral-200 shadow-soft flex items-center justify-center text-4xl"
          >
            {store.emoji}
          </div>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-m-h2 lg:text-h3 font-bold flex items-center gap-2">
              🏪 {store.name}
              {store.verified && <ShieldCheck size={22} className="text-success-500" />}
            </h1>
            <p className="text-body-sm text-neutral-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-warning-500">★ {store.rating}</span>
              <span>({store.reviews} reviews)</span>
              <span>📍 {formatKm(dist)}</span>
              <span>{store.open ? '🟢 Open' : `Closed now · Opens at ${store.opensAt}`}</span>
              <span className="text-neutral-400">{store.hours}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {store.verified && <VerifiedBadge />}
              {store.pickup && <StatusBadge kind="ready">📦 Pickup</StatusBadge>}
              {store.localDelivery && <StatusBadge kind="stock">🛵 Local Delivery</StatusBadge>}
              {store.localMaker && <StatusBadge kind="low">🎨 Local Maker</StatusBadge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={isFollowed ? 'soft' : 'primary'}
              size="lg"
              onClick={() => {
                toggleFollow(id)
                toast({
                  kind: 'info',
                  title: isFollowed ? 'Unfollowed' : 'Following ' + store.name,
                  body: isFollowed ? undefined : "You'll get new stock & offer alerts.",
                })
              }}
            >
              {isFollowed ? '✓ Following' : 'Follow Store'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => toast({ kind: 'success', title: 'Store link copied', body: `nearbuy.com/store/${store.slug}` })}
            >
              <Share2 size={18} /> Share
            </Button>
          </div>
        </div>

        {/* tabs */}
        <Tabs<Tab>
          tabs={[
            { id: 'products', label: 'Products', count: listings.length },
            { id: 'offers', label: 'Offers', count: offers.length || undefined },
            { id: 'new', label: 'New Arrivals' },
            { id: 'reviews', label: 'Reviews', count: reviews.length || undefined },
            { id: 'about', label: 'About' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'products' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {listings.map((l) => (
              <ProductCard key={l.productId} productId={l.productId} />
            ))}
          </div>
        )}

        {tab === 'offers' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {offers.length ? (
              offers.map((o) => (
                <div key={o.id} className="nb-card p-5">
                  <StatusBadge kind="out">💰 Save ₹{o.savings}</StatusBadge>
                  <p className="text-body font-semibold mt-3">{o.title}</p>
                  <p className="text-body-sm text-neutral-500 mt-1">{o.detail}</p>
                  {o.endsIn && <p className="text-caption text-warning-700 mt-2 font-semibold">⏳ {o.endsIn}</p>}
                </div>
              ))
            ) : (
              <p className="text-body-sm text-neutral-500">No active offers right now.</p>
            )}
          </div>
        )}

        {tab === 'new' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {listings.slice(0, 4).map((l) => (
              <ProductCard key={l.productId} productId={l.productId} compact />
            ))}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="nb-card p-6 space-y-5 max-w-2xl">
            {reviews.length ? (
              reviews.map((r) => (
                <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                  <p className="text-body font-semibold">
                    {r.author} <span className="text-warning-500">★ {r.rating}</span>{' '}
                    <span className="text-caption text-neutral-400 font-normal">· {r.when}</span>
                  </p>
                  <p className="text-body-sm text-neutral-600 mt-1">{r.text}</p>
                </div>
              ))
            ) : (
              <p className="text-body-sm text-neutral-500">No reviews yet.</p>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 nb-card p-6 space-y-4">
              <h3 className="text-h5 font-bold">About {store.name}</h3>
              <p className="text-body text-neutral-600">{store.blurb}</p>
              <p className="text-body-sm text-neutral-500">
                Serving Dwarka since {store.since} · {store.followers.toLocaleString('en-IN')} followers on NearBuy
              </p>
              <div>
                <p className="text-body-sm font-semibold mb-2">Address</p>
                <p className="text-body-sm text-neutral-600">{store.address}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {(
                  [
                    ['Inventory accuracy', store.health.inventoryAccuracy],
                    ['Order acceptance', store.health.orderAcceptance],
                    ['Reservation confirm', store.health.reservationConfirm],
                    ['Preparation speed', store.health.prepTime],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-caption text-neutral-500">{label}</p>
                    <div className="h-2 bg-neutral-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                    <p className="text-caption font-semibold text-neutral-700 mt-1">{val}%</p>
                  </div>
                ))}
              </div>
              <p className="text-caption text-neutral-400">
                Operational metrics shown with context — not collapsed into a single score.
              </p>
            </div>
            <div className="space-y-4">
              <div className="nb-card p-5 text-center">
                <p className="text-body-sm font-semibold mb-3">Store QR — scan at the counter</p>
                <div className="inline-block bg-white p-3 rounded-lg border border-neutral-200">
                  <QRCodeSVG value={`https://nearbuy.com/store/${store.slug}`} size={120} />
                </div>
                <p className="text-caption text-neutral-500 mt-3">
                  nearbuy.com/store/{store.slug}
                </p>
                <p className="text-caption text-neutral-500">
                  Customers scan → digital storefront → reserve & pickup
                </p>
              </div>
              <div className="nb-card p-2">
                <NearbyMap stores={[store]} height={180} />
                <p className="text-caption text-neutral-500 p-3">
                  📍 {store.address} · {formatKm(dist)} from you
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
