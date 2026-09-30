import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Heart, ShoppingCart } from 'lucide-react'
import { PICKUP_WINDOWS } from '../data/catalog'
import { useCatalog } from '../store/CatalogContext'
import type { FulfillmentType } from '../data/types'
import {
  foundNearby,
  getProduct,
  listingsForProduct,
} from '../lib/geo'
import { formatINR, formatKm, relativeDays } from '../lib/format'
import {
  AvailabilityLine,
  buildFulfillmentOptions,
  CompareOptions,
  FoundNearbyPanel,
  FulfillmentSelector,
  HoldForMe,
  ProductVisual,
  WalkInReady,
  type FulfillmentOption,
} from '../components/commerce'
import {
  Alert,
  Button,
  NearbyBadge,
  Price,
  ReserveBadge,
  StatusBadge,
  VerifiedBadge,
} from '../components/ui'
import { useApp } from '../store/AppContext'
import { api } from '../auth/api'
import { reservationFromApi, type ApiReservation } from '../store/serverCommerce'

export default function ProductPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { storeReviews } = useCatalog()
  const product = getProduct(id)
  const { addToCart, wishlist, toggleWishlist, placeReservation, toast } = useApp()

  const listings = listingsForProduct(id)
  const inStock = listings.filter((l) => l.stock > 0 && l.store.open)
  const preferredStore = params.get('store') ?? inStock[0]?.store.id
  const listing = inStock.find((l) => l.store.id === preferredStore) ?? inStock[0]

  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    (params.get('action') === 'reserve' ? 'reserve' : 'local') as FulfillmentType,
  )
  const [qty, setQty] = useState(1)
  const [windowStr, setWindowStr] = useState(PICKUP_WINDOWS[1])
  const [reserving, setReserving] = useState(false)
  const [reserveError, setReserveError] = useState('')
  const submitting = useRef(false)
  const options: FulfillmentOption[] = product
    ? buildFulfillmentOptions(product, listing ? { store: listing.store, distance: listing.distance, reserveable: listing.reserveable } : undefined)
    : []

  useEffect(() => {
    if (params.get('action') === 'reserve') setFulfillment('reserve')
    if (params.get('action') === 'buy') setFulfillment('local')
  }, [params])

  if (!product) return <div className="nb-container py-20 text-center">Product not found.</div>

  const liked = wishlist.includes(id)
  const reviews = (listing ? storeReviews[listing.store.id] ?? [] : []).slice(0, 3)
  const found = foundNearby(id)

  async function onPrimary() {
    if (!listing || submitting.current) return
    if (fulfillment === 'reserve') {
      submitting.current = true
      setReserving(true)
      setReserveError('')
      try {
        const reservation = await api.post<ApiReservation>('/checkout/reservations', {
          items: [{ productId: id, storeId: listing.store.id, qty }], pickupWindow: windowStr,
        })
        placeReservation(reservationFromApi(reservation))
        toast({ kind: 'success', title: 'Reservation requested', body: `Waiting for ${listing.store.name} to confirm.` })
        navigate('/reservations')
      } catch (cause) {
        setReserveError(cause instanceof Error ? cause.message : 'Could not request your reservation.')
      } finally {
        submitting.current = false
        setReserving(false)
      }
    } else if (fulfillment === 'pickup') {
      addToCart({ productId: id, storeId: listing.store.id, qty, price: listing.price })
      navigate('/checkout?mode=pickup')
    } else {
      addToCart({ productId: id, storeId: listing.store.id, qty, price: listing.price })
      toast({ kind: 'success', title: 'Added to cart', body: `${product.name} · ${qty} unit(s)` })
      navigate('/cart')
    }
  }

  return (
    <div className="nb-container py-6 lg:py-10 space-y-8">
      {/* breadcrumb */}
      <nav className="text-body-sm text-neutral-500">
        <Link to="/customer" className="hover:text-primary-500">Home</Link>
        {' / '}
        <Link to={`/search?q=${product.category}`} className="hover:text-primary-500 capitalize">{product.category}</Link>
        {' / '}
        <span className="text-neutral-800 font-medium">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* gallery */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="nb-card p-6">
            <ProductVisual product={product} className="rounded-xl" />
          </div>
          {found.stores > 0 && <FoundNearbyPanel productId={id} />}
        </div>

        {/* info */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-m-h2 lg:text-h2 font-bold">{product.name}</h1>
              <button
                aria-label="Wishlist"
                onClick={() => toggleWishlist(id)}
                className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center shrink-0 hover:shadow-soft min-h-touch min-w-touch"
              >
                <Heart size={20} className={liked ? 'fill-deal text-deal' : 'text-neutral-500'} />
              </button>
            </div>
            <p className="text-body-sm text-neutral-500 mt-1">
              {product.brand} ·{' '}
              <span className="text-warning-500">★</span> {product.rating} ({product.ratingCount} ratings)
            </p>
            <Price value={listing?.price ?? product.price} mrp={product.mrp} size="page" className="mt-3" />
            {product.online && (
              <p className="text-body-sm text-neutral-500 mt-1">
                Online {formatINR(product.online.price)} · arrives in {relativeDays(product.online.etaDaysMin, product.online.etaDaysMax)}
              </p>
            )}
          </div>

          <p className="text-body text-neutral-600">{product.description}</p>

          <div className="flex flex-wrap gap-2">
            {found.closestKm !== null && <NearbyBadge km={found.closestKm} />}
            {found.fastestMins !== null && <StatusBadge kind="low">⚡ {found.fastestMins} min</StatusBadge>}
            <StatusBadge kind={found.stores ? 'stock' : 'out'}>
              {found.stores ? `✓ ${found.units} available nearby` : 'Currently unavailable'}
            </StatusBadge>
          </div>

          {/* WALK-IN READY for immediate pickup */}
          {listing && listing.store.open && listing.store.pickup && listing.stock > 0 && (
            <WalkInReady listing={{ stock: listing.stock, store: listing.store }} />
          )}

          {/* fulfillment selector — the heart of the page */}
          <section>
            <h2 className="text-h5 font-bold mb-3">How do you want to get it?</h2>
            <FulfillmentSelector options={options} selected={fulfillment} onSelect={setFulfillment} />
            {fulfillment === 'reserve' && (
              <div className="mt-4 rounded-xl bg-reservebg border border-reserveborder p-4">
                <p className="text-body-sm font-semibold text-[#6D28D9] mb-2">Available Pickup Windows</p>
                <div className="flex flex-wrap gap-2">
                  {PICKUP_WINDOWS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowStr(w)}
                      className={`px-3.5 h-10 rounded-full text-body-sm font-semibold min-h-touch transition-colors duration-fast ${
                        windowStr === w ? 'bg-reserve text-white' : 'bg-white border border-reserveborder text-[#6D28D9]'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* CTAs */}
          {reserveError && <Alert kind="warning" title="Could not reserve this item">{reserveError}</Alert>}
          {listing ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border border-neutral-300 rounded-md h-12 px-2">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-md hover:bg-neutral-100 text-lg min-h-touch" aria-label="Decrease">
                  −
                </button>
                <span className="font-data font-bold w-6 text-center">{qty}</span>
                <button onClick={() => setQty(Math.min(listing.stock, qty + 1))} className="w-9 h-9 rounded-md hover:bg-neutral-100 text-lg min-h-touch" aria-label="Increase">
                  +
                </button>
              </div>
              {fulfillment === 'reserve' ? (
                <Button variant="reserve" size="xl" className="flex-1" onClick={() => void onPrimary()} disabled={reserving} loading={reserving}>
                  <ReserveBadge className="bg-white/20 text-white" /> {reserving ? 'Requesting…' : 'Reserve & Pickup'}
                </Button>
              ) : (
                <Button size="xl" className="flex-1" onClick={() => void onPrimary()}>
                  <ShoppingCart size={20} /> {fulfillment === 'pickup' ? 'Pickup Today' : 'Buy Now'}
                </Button>
              )}
            </div>
          ) : (
            <Alert kind="warning" title="Currently unavailable nearby">
              Notify Me or Find Nearby alternatives.{' '}
              <button className="nb-link" onClick={() => navigate('/nearai')}>
                Ask NearAI to watch for stock
              </button>
            </Alert>
          )}

          {/* live stock check */}
          {listing && (
            <div className="nb-card p-4">
              <p className="text-body-sm font-semibold mb-2">Availability confidence</p>
              <AvailabilityLine listing={{ ...listing, store: listing.store }} productId={id} />

            </div>
          )}
        </div>
      </div>

      {/* compare options */}
      <CompareOptions productId={id} />

      {/* stores carrying this */}
      <section>
        <h2 className="text-h5 font-bold mb-3">Stores carrying this near you</h2>
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.store.id} className="nb-card p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <p className="text-body font-semibold text-neutral-900 flex items-center gap-1.5">
                  🏪 {l.store.name}
                  {l.store.verified && <VerifiedBadge />}
                </p>
                <p className="text-[13px] text-neutral-500 mt-0.5">
                  📍 {formatKm(l.distance)} ·{' '}
                  {l.store.open ? (
                    <span className="text-success-600 font-semibold">Open</span>
                  ) : (
                    <span>Closed now · Opens at {l.store.opensAt}</span>
                  )}{' '}
                  · {l.stock > 0 ? `${l.stock} in stock` : 'Out of stock'}
                </p>
                <div className="mt-2">
                  <AvailabilityLine listing={{ ...l, store: l.store }} productId={id + l.store.id} />
                </div>
              </div>
              <div className="text-right">
                <p className="font-data font-bold text-xl">{formatINR(l.price)}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/store/${l.store.id}`)}
                  >
                    View Store
                  </Button>
                  <Button
                    variant="reserve"
                    size="sm"
                    disabled={l.stock <= 0}
                    onClick={() => {
                      const code = 'NB-' + Math.floor(4000 + Math.random() * 5000)
                      placeReservation({
                        id: 'RSV-' + Math.floor(5500 + Math.random() * 400),
                        code,
                        items: [{ productId: id, storeId: l.store.id, qty: 1, price: l.price }],
                        status: 'awaiting',
                        storeId: l.store.id,
                        placedAt: Date.now(),
                        window: PICKUP_WINDOWS[1],
                        expiresAt: Date.now() + 3 * 3600e3,
                        timeline: [{ label: 'Requested', at: Date.now() }],
                      })
                      toast({ kind: 'success', title: 'Reservation requested', body: `${l.store.name} will confirm shortly.` })
                      navigate('/reservations')
                    }}
                  >
                    Reserve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* hold for me + reviews */}
      <div className="grid lg:grid-cols-2 gap-6">
        {listing && <HoldForMe />}
        <div className="nb-card p-5">
          <h3 className="text-h5 font-bold mb-3">Store reviews</h3>
          {reviews.length ? (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-3 last:pb-0">
                  <p className="text-body-sm font-semibold">
                    {r.author} <span className="text-warning-500">★ {r.rating}</span>{' '}
                    <span className="text-caption text-neutral-400 font-normal">· {r.when}</span>
                  </p>
                  <p className="text-body-sm text-neutral-600 mt-1">{r.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-neutral-500">No reviews yet for this store.</p>
          )}
        </div>
      </div>
    </div>
  )
}
