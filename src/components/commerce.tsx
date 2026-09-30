import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  Bike,
  ChevronRight,
  Clock,
  Heart,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Search as SearchIcon,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
  X,
  type LucideIcon,
} from 'lucide-react'
import type {
  FulfillmentType,
  Order,
  Product,
  Reservation,
  Store,
} from '../data/types'
import {
  availabilityConfidence,
  compareOptions,
  fastestPickupMins,
  fastestSort,
  foundNearby,
  getProduct,
  getStore,
  listingsForProduct,
  sortCompare,
  storeDistance,
  type CompareRow,
  type SortKey,
} from '../lib/geo'
import { formatINR, formatKm, minsUntil, timeAgo } from '../lib/format'
import { useApp } from '../store/AppContext'
import { Button, FastBadge, NearbyBadge, Price, ProductCardSkeleton, ReserveBadge, StatusBadge, VerifiedBadge } from './ui'
import { categoryById } from '../lib/liveCatalog'
import { CategoryIcon, iconForProduct } from './visuals'

/* ── Product visual (consistent category tiles + real photos) ── */
export function ProductVisual({
  product,
  className = '',
}: {
  product: Product
  className?: string
}) {
  const cat = categoryById(product.category)
  const photo: Record<string, string> = {
    p13: '/images/school-supplies.jpg',
    p14: '/images/school-supplies.jpg',
    p15: '/images/school-supplies.jpg',
    p17: '/images/school-supplies.jpg',
    p28: '/images/gifts.jpg',
    p29: '/images/gifts.jpg',
    p25: '/images/local-market.jpg',
    p26: '/images/local-market.jpg',
  }
  const src = product.cover || photo[product.id]
  const Icon = iconForProduct(product)
  return (
    <div
      className={`relative aspect-[4/3] rounded-lg overflow-hidden bg-neutral-50 flex items-center justify-center ${className}`}
      style={{ background: cat?.tint ?? '#F8FAFC', '--art-accent': cat?.accent ?? '#2563EB' } as React.CSSProperties}
    >
      {src ? (
        <img src={src} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="product-art" role="img" aria-label={`${product.name} illustration`}>
          <span className="product-art-orbit" />
          <span className="product-art-icon"><Icon strokeWidth={1.45} aria-hidden="true" /></span>
          <span className="product-art-dot one" /><span className="product-art-dot two" />
        </div>
      )}
    </div>
  )
}

/* ── Product card ───────────────────────────────────────── */
export function ProductCard({
  productId,
  compact,
}: {
  productId: string
  compact?: boolean
}) {
  const product = getProduct(productId)
  const navigate = useNavigate()
  const { wishlist, toggleWishlist } = useApp()
  const found = foundNearby(productId)
  const listings = listingsForProduct(productId).filter((l) => l.stock > 0)
  const minPrice = listings.length ? Math.min(...listings.map((l) => l.price)) : product.price
  const liked = wishlist.includes(productId)

  return (
    <div className="nb-card p-0 overflow-hidden flex flex-col group">
      <Link to={`/product/${productId}`} className="relative block">
        <ProductVisual product={product} className="rounded-none" />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {found.stores > 0 ? (
            <StatusBadge kind="stock">✓ In Stock</StatusBadge>
          ) : (
            <StatusBadge kind="out">Currently unavailable</StatusBadge>
          )}
          {listings[0] && listings[0].distance < 1.2 && (
            <NearbyBadge km={found.closestKm!} />
          )}
        </div>
        <button
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e) => {
            e.preventDefault()
            toggleWishlist(productId)
          }}
          className="absolute top-2.5 right-2.5 w-10 h-10 rounded-full bg-white/95 shadow-soft flex items-center justify-center hover:scale-105 transition-transform duration-fast min-h-touch min-w-touch"
        >
          <Heart size={18} className={liked ? 'fill-deal text-deal' : 'text-neutral-500'} />
        </button>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link
          to={`/product/${productId}`}
          className="text-body font-semibold text-neutral-900 line-clamp-2 hover:text-primary-600 transition-colors duration-fast"
        >
          {product.name}
        </Link>
        <div className="text-caption text-neutral-500 mt-1 flex items-center gap-1.5">
          <span className="text-warning-500">★</span> {product.rating}
          <span className="text-neutral-300">·</span>
          {product.brand}
        </div>
        <Price value={minPrice} mrp={product.mrp} className="mt-2.5" />
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {found.closestKm !== null && (
              <span className="text-[13px] font-medium text-neutral-500">
                📍 {formatKm(found.closestKm)}
              </span>
            )}
            {found.fastestMins !== null && (
              <>
                <span className="text-neutral-300">·</span>
                <span className="text-[13px] font-medium text-fast">⚡ {found.fastestMins} min</span>
              </>
            )}
            <span className="text-neutral-300">·</span>
            <span className="text-[13px] font-medium text-success-600">
              {found.stores} store{found.stores === 1 ? '' : 's'}
            </span>
          </div>
        )}
        <div className="mt-3 flex gap-2 mt-auto pt-3">
          <Button
            variant="reserve"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/product/${productId}?action=reserve`)}
          >
            Reserve
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/product/${productId}?action=buy`)}
          >
            Buy
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Store card ─────────────────────────────────────────── */
export function StoreCard({ storeId }: { storeId: string }) {
  const store = getStore(storeId)
  const navigate = useNavigate()
  const dist = storeDistance(store)
  const { followed, toggleFollow } = useApp()
  const isFollowed = followed.includes(storeId)
  return (
    <div className="nb-card overflow-hidden flex flex-col">
      <Link to={`/store/${storeId}`} className="block relative h-28 bg-neutral-100">
        {store.cover ? (
          <img src={store.cover} alt={store.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: categoryById(store.category)?.tint, color: categoryById(store.category)?.accent }}>
            <CategoryIcon category={store.category} size={48} />
          </div>
        )}
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <Link to={`/store/${storeId}`} className="text-h5 font-bold text-neutral-900 hover:text-primary-600">
            {store.name}
          </Link>
          {store.verified && <ShieldCheck size={18} className="text-success-500 shrink-0 mt-0.5" />}
        </div>
        <div className="text-[13px] font-medium text-neutral-500 mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-warning-500">★</span> {store.rating}
          <span className="text-neutral-300">·</span>
          📍 {formatKm(dist)}
          <span className="text-neutral-300">·</span>
          {store.open ? (
            <span className="text-success-600 font-semibold">🟢 Open</span>
          ) : (
            <span className="text-neutral-500 font-semibold">Closed now · Opens at {store.opensAt}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {store.pickup && <StatusBadge kind="ready">📦 Pickup</StatusBadge>}
          {store.localDelivery && <StatusBadge kind="stock">🛵 Local Delivery</StatusBadge>}
          {store.verified && <VerifiedBadge />}
        </div>
        <div className="mt-auto pt-3 flex gap-2">
          <Button
            variant={isFollowed ? 'soft' : 'secondary'}
            size="sm"
            className="flex-1"
            onClick={() => toggleFollow(storeId)}
          >
            {isFollowed ? '✓ Following' : 'Follow Store'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/store/${storeId}`)}>
            View Store
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Search bar ────────────────────────────────────────── */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  autoFocus?: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex items-center gap-3 h-[52px] lg:h-14 px-4 rounded-xl lg:rounded-xl border border-neutral-200 bg-white shadow-search"
    >
      <SearchIcon size={20} className="text-neutral-400 lg:w-6 lg:h-6" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search local products"
        aria-label="Search products and stores"
        autoFocus={autoFocus}
        className="flex-1 bg-transparent outline-none text-[15px] lg:text-body placeholder:text-neutral-500 min-w-0"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-neutral-400 hover:text-neutral-600 min-h-touch min-w-touch flex items-center justify-center">
          <X size={18} />
        </button>
      )}
      <Button type="submit" size="sm" className="hidden sm:inline-flex">
        Search
      </Button>
    </form>
  )
}

/* ── Availability confidence + live stock check ─────────── */
export function AvailabilityLine({
  listing,
  productId,
}: {
  listing: { updatedMinsAgo: number; stock: number; store: Store }
  productId: string
}) {
  const conf = availabilityConfidence(listing.updatedMinsAgo)
  const { liveChecks, requestLiveCheck } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const asked = liveChecks[`${listing.store.id}:${productId}`]
  async function request() {
    setBusy(true)
    setError('')
    try { await requestLiveCheck(productId, listing.store.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reach the store. Try again.') }
    finally { setBusy(false) }
  }
  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${conf.className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${conf.key === 'fresh' ? 'bg-success-500' : conf.key === 'stale' ? 'bg-warning-500' : 'bg-neutral-400'}`} />
        {conf.label} · {conf.hint}
      </div>
      {conf.key !== 'fresh' && !asked && <Button variant="secondary" size="sm" disabled={busy} loading={busy} onClick={() => void request()}>Ask store to confirm</Button>}
      {asked === 'pending' && <p className="text-caption text-primary-600 font-semibold">Shelf check sent. Waiting for the store to reply.</p>}
      {asked === 'available' && <p className="text-caption text-success-700 font-semibold">The store confirmed stock. This is not a hold — reserve it to be sure.</p>}
      {asked === 'unavailable' && <p className="text-caption text-warning-700 font-semibold">The store could not confirm stock right now. Try another nearby store.</p>}
      {error && <p role="alert" className="text-caption text-error-600">{error}</p>}
    </div>
  )
}

/* ── Fulfillment selector (visual heart of product page) ── */
export interface FulfillmentOption {
  id: FulfillmentType
  icon: LucideIcon
  title: string
  detail: string
  fee: number
  available: boolean
}

export function buildFulfillmentOptions(_product: Product, listing?: { store: Store; distance: number; reserveable?: boolean }): FulfillmentOption[] {
  const d = listing?.distance ?? 1.2
  const s = listing?.store
  // Online standard/fast delivery is a comparison, not a checkout choice in
  // this local-store journey. Offer only methods the checkout can fulfil.
  return [
    {
      id: 'local', icon: Bike, title: 'Local delivery',
      detail: s ? `From ${s.name} · about ${35 + Math.round(d * 8)} min` : 'Not deliverable',
      fee: 30, available: !!s && s.localDelivery && s.open,
    },
    {
      id: 'pickup', icon: StoreIcon, title: 'Pickup today',
      detail: s ? `${formatKm(d)} away · store confirms when ready` : 'No nearby store',
      fee: 0, available: !!s && s.pickup && s.open,
    },
    {
      id: 'reserve', icon: PackageCheck, title: 'Reserve & Pickup',
      detail: s ? 'Ask the store to hold it for your chosen window' : 'No nearby store',
      fee: 0, available: !!s && s.pickup && s.open && !!listing?.reserveable,
    },
  ]
}

export function FulfillmentSelector({
  options,
  selected,
  onSelect,
}: {
  options: FulfillmentOption[]
  selected: FulfillmentType
  onSelect: (id: FulfillmentType) => void
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((o) => {
        const active = selected === o.id
        const Icon = o.icon
        return (
          <button
            key={o.id}
            disabled={!o.available}
            onClick={() => onSelect(o.id)}
            className={`text-left rounded-xl border-2 p-4 transition-all duration-fast min-h-touch ${
              active
                ? 'border-primary-500 bg-primary-50 shadow-soft'
                : 'border-neutral-200 bg-white hover:border-primary-200'
            } ${!o.available ? 'opacity-45 pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-primary-600"><Icon size={21} strokeWidth={1.8} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-neutral-900 flex items-center gap-2">
                  {o.title}
                  {o.id === 'reserve' && <ReserveBadge />}
                </p>
                <p className="text-[13px] text-neutral-500 mt-0.5">{o.detail}</p>
              </div>
              <span className="text-[13px] font-bold text-neutral-700">
                {o.fee === 0 ? 'FREE' : formatINR(o.fee)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ── Found Nearby summary ───────────────────────────────── */
export function FoundNearbyPanel({ productId }: { productId: string }) {
  const f = foundNearby(productId)
  return (
    <div className="rounded-xl bg-primary-50 border border-primary-100 p-5">
      <p className="text-caption font-bold text-primary-600 tracking-wider uppercase mb-3">✓ Found Nearby</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['✓', `${f.stores} stores`, 'with stock'],
          ['✓', `${f.units} units`, 'available'],
          ['✓', f.closestKm !== null ? formatKm(f.closestKm) : '—', 'closest'],
          ['✓', f.fastestMins !== null ? `${f.fastestMins} min` : '—', 'fastest delivery'],
        ].map(([icon, val, label]) => (
          <div key={label as string}>
            <p className="text-body font-bold text-primary-700">
              {icon} {val}
            </p>
            <p className="text-caption text-primary-600/70">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Compare your options ───────────────────────────────── */
export function CompareOptions({ productId }: { productId: string }) {
  const [sort, setSort] = useState<SortKey>('cheapest')
  const product = getProduct(productId)
  const rows = useMemo(() => {
    const base = compareOptions(productId)
    return sort === 'fastest' ? fastestSort(base, product.online?.etaDaysMin ?? 5) : sortCompare(base, sort)
  }, [productId, sort, product])

  const criteria: { id: SortKey; label: string }[] = [
    { id: 'cheapest', label: 'Cheapest' },
    { id: 'fastest', label: 'Fastest' },
    { id: 'nearest', label: 'Nearest' },
    { id: 'pickup', label: 'Pickup' },
  ]

  return (
    <div className="nb-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-h5 font-bold">Compare Your Options</h3>
        <div className="flex gap-2">
          {criteria.map((c) => (
            <button
              key={c.id}
              onClick={() => setSort(c.id)}
              className={`px-3.5 h-9 rounded-full text-caption font-semibold transition-colors duration-fast min-h-touch ${
                sort === c.id ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-caption text-neutral-500 mb-3">
        Sorted by <span className="font-semibold text-neutral-700">{criteria.find((c) => c.id === sort)!.label.toLowerCase()}</span> — the selection criteria is always shown.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] nb-table font-data">
          <thead>
            <tr>
              <th>Option</th>
              <th>Price</th>
              <th>Distance</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: CompareRow, i) => (
              <tr key={i} className={i === 0 ? 'bg-primary-50/50' : ''}>
                <td>
                  <span className="font-semibold text-neutral-900">
                    {r.kind === 'online' ? '🌐 Online' : '🏪'} {r.label}
                  </span>
                  {i === 0 && (
                    <span className="ml-2 text-caption font-bold text-primary-600 uppercase">
                      {sort} pick
                    </span>
                  )}
                </td>
                <td className="font-semibold text-neutral-900">{formatINR(r.price)}</td>
                <td>{r.distance !== null ? formatKm(r.distance) : '—'}</td>
                <td>{r.timeLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Order / reservation timelines ──────────────────────── */
const ORDER_STEPS = ['Order Confirmed', 'Seller Preparing', 'Packed', 'Out for Delivery', 'Delivered']
const PICKUP_STEPS = ['Order Confirmed', 'Packed', 'Ready for Pickup', 'Collected']
const RES_STEPS = ['Requested', 'Confirmed', 'Packed', 'Ready', 'Collected']

export function Timeline({ steps, doneCount }: { steps: string[]; doneCount: number }) {
  return (
    <div className="space-y-0">
      {steps.map((s, i) => {
        const done = i < doneCount
        const current = i === doneCount
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3.5 h-3.5 rounded-full mt-1 ${
                  done ? 'bg-success-500' : current ? 'bg-primary-500 ring-4 ring-primary-100' : 'bg-neutral-300'
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[26px] ${done ? 'bg-success-500' : 'bg-neutral-200'}`} />
              )}
            </div>
            <p
              className={`text-body-sm pb-3 ${
                done ? 'text-neutral-800 font-medium' : current ? 'text-primary-600 font-semibold' : 'text-neutral-400'
              }`}
            >
              {s}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function OrderTimeline({ order }: { order: Order }) {
  const steps = order.fulfillment === 'pickup' ? PICKUP_STEPS : ORDER_STEPS
  return <Timeline steps={steps} doneCount={order.timeline.length - (order.status === 'cancelled' ? 1 : 0)} />
}

export function ReservationTimeline({ reservation }: { reservation: Reservation }) {
  return <Timeline steps={RES_STEPS} doneCount={reservation.timeline.length} />
}

/* ── Reservation card with QR ───────────────────────────── */
const resStatusMeta: Record<string, { label: string; kind: string; emoji: string }> = {
  awaiting: { label: 'Awaiting Confirmation', kind: 'low', emoji: '🟠' },
  confirmed: { label: 'Confirmed', kind: 'stock', emoji: '🟢' },
  packed: { label: 'Packed', kind: 'ready', emoji: '📦' },
  ready: { label: 'Ready for Pickup', kind: 'ready', emoji: '📦' },
  collected: { label: 'Collected', kind: 'stock', emoji: '✅' },
  expired: { label: 'Expired', kind: 'closed', emoji: '⌛' },
  cancelled: { label: 'Cancelled', kind: 'out', emoji: '❌' },
}

export function ReservationCard({
  reservation,
  expandable = true,
}: {
  reservation: Reservation
  expandable?: boolean
}) {
  const [open, setOpen] = useState(reservation.status === 'ready')
  const store = getStore(reservation.storeId)
  const meta = resStatusMeta[reservation.status]
  const total = reservation.items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <div className="rounded-xl bg-reservebg border border-reserveborder overflow-hidden">
      <button
        className="w-full text-left p-5 min-h-touch"
        onClick={() => expandable && setOpen((o) => !o)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-h5 font-bold text-neutral-900">{reservation.id}</p>
            <p className="text-[13px] text-neutral-500 mt-0.5">
              Pickup code <span className="font-bold font-data text-[#6D28D9]">{reservation.code}</span>
              {' · '}
              {store.name} · {store.area}
            </p>
          </div>
          <StatusBadge kind={meta.kind as 'ready'}>
            {meta.emoji} {meta.label}
          </StatusBadge>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-neutral-600">
          <span>🕐 Window: {reservation.window}</span>
          {reservation.status === 'ready' && (
            <span className="text-warning-700 font-semibold">
              ⌛ Expires in {minsUntil(reservation.expiresAt)} min
            </span>
          )}
          <span className="font-data font-semibold text-neutral-900">{formatINR(total)}</span>
        </div>
        {expandable && (
          <p className="text-caption text-[#6D28D9] mt-2 font-semibold">{open ? 'Hide details ▲' : 'Show QR & items ▼'}</p>
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 animate-slideup">
          <div className="flex flex-col xs:flex-row gap-5 items-center bg-white rounded-xl border border-reserveborder p-5">
            <div className="bg-white p-3 rounded-lg border border-neutral-200">
              <QRCodeSVG value={`nearbuy://pickup/${reservation.serverId ?? reservation.id}/${reservation.code}`} size={128} />
            </div>
            <div className="text-center xs:text-left">
              <p className="text-caption text-neutral-500 uppercase font-bold tracking-wider">Pickup Code</p>
              <p className="text-h2 font-extrabold font-data text-[#6D28D9]">{reservation.code}</p>
              <p className="text-body-sm text-neutral-600 mt-1">Show this QR code at {store.name}</p>
              <p className="text-caption text-neutral-500 mt-1">{store.address}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-reserveborder divide-y divide-neutral-100">
            {reservation.items.map((it) => {
              const p = getProduct(it.productId)
              return (
                <Link
                  key={it.productId}
                  to={`/product/${it.productId}`}
                  className="flex items-center gap-3 p-3.5 hover:bg-neutral-50 transition-colors duration-fast min-h-touch"
                >
                  <ProductVisual product={p} className="w-14 h-14 rounded-md shrink-0 aspect-none" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-neutral-900 truncate">{p.name}</p>
                    <p className="text-caption text-neutral-500">Qty {it.qty}</p>
                  </div>
                  <p className="font-data font-bold text-neutral-900">{formatINR(it.price * it.qty)}</p>
                </Link>
              )
            })}
          </div>
          <ReservationTimeline reservation={reservation} />
        </div>
      )}
    </div>
  )
}

/* ── Order card ─────────────────────────────────────────── */
const orderStatusMeta: Record<string, { label: string; kind: string }> = {
  pending: { label: 'Pending', kind: 'low' },
  confirmed: { label: 'Confirmed', kind: 'ready' },
  preparing: { label: 'Preparing', kind: 'ready' },
  ready: { label: 'Ready', kind: 'reserved' },
  out_for_delivery: { label: 'Out for Delivery', kind: 'ready' },
  delivered: { label: 'Delivered', kind: 'stock' },
  picked_up: { label: 'Picked Up', kind: 'stock' },
  cancelled: { label: 'Cancelled', kind: 'out' },
  returned: { label: 'Returned', kind: 'closed' },
}

export function OrderCard({ order, onTrack }: { order: Order; onTrack?: () => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(order.status === 'out_for_delivery')
  const meta = orderStatusMeta[order.status]
  const item = order.items[0]
  const p = getProduct(item.productId)
  const store = getStore(item.storeId)
  return (
    <div className="nb-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-caption font-bold text-neutral-400 font-data tracking-wider">{order.id}</p>
          <p className="text-body font-semibold text-neutral-900 mt-1">{p.name}</p>
          {order.items.length > 1 && (
            <p className="text-caption text-neutral-500">+{order.items.length - 1} more item(s)</p>
          )}
          <p className="font-data font-bold text-xl mt-1">{formatINR(p.price * item.qty)}</p>
        </div>
        <StatusBadge kind={meta.kind as 'ready'}>{meta.label}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-neutral-500">
        <span>🏪 {store.name}</span>
        <span>📍 {formatKm(storeDistance(store))}</span>
        {order.etaMins ? (
          <span className="text-fast font-semibold">⚡ Arriving in {order.etaMins} min</span>
        ) : (
          <span className="capitalize">{order.fulfillment.replace('_', ' ')}</span>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="md" className="flex-1 sm:flex-none" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide Details' : 'Track'}
        </Button>
        {order.status === 'out_for_delivery' && onTrack && (
          <Button variant="secondary" size="md" onClick={onTrack}>
            <TruckIcon /> Live Map
          </Button>
        )}
        <Button
          variant="ghost"
          size="md"
          onClick={() => navigate(`/product/${item.productId}`)}
        >
          Buy Again
        </Button>
      </div>
      {open && (
        <div className="mt-5 pt-5 border-t border-neutral-100 grid md:grid-cols-2 gap-6 animate-slideup">
          <OrderTimeline order={order} />
          <div className="space-y-2 text-body-sm text-neutral-600">
            {order.handoffCode && order.status === 'out_for_delivery' && (
              <div className="rounded-lg bg-success-50 border border-success-200 p-3.5">
                <p className="font-bold text-success-800">Customer handoff code <span className="font-data tracking-widest text-lg ml-1">{order.handoffCode}</span></p>
                <p className="text-caption text-success-700 mt-1">Give this code only to the rider at your door.</p>
              </div>
            )}
            {order.courier && (
              <p>
                <Package size={14} className="inline mr-1" /> {order.courier}
              </p>
            )}
            {order.etaMins && (
              <p>
                <Clock size={14} className="inline mr-1" /> Arriving in ~{order.etaMins} min
              </p>
            )}
            <p>Total {formatINR(order.total)} · Delivery fee {formatINR(order.deliveryFee)}</p>
            <p className="text-caption text-neutral-400">Placed {timeAgo(Math.round((Date.now() - order.placedAt) / 60000))}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TruckIcon() {
  return <ChevronRight size={16} className="inline -ml-1" />
}

/* ── Walk-in ready panel ────────────────────────────────── */
export function WalkInReady({ listing }: { listing: { stock: number; store: Store } }) {
  return (
    <div className="rounded-xl bg-success-50 border border-success-200 p-5">
      <p className="text-caption font-bold text-success-600 tracking-wider uppercase mb-3">⚡ Walk-In Ready</p>
      <ul className="space-y-1.5 text-body-sm text-success-700 font-medium">
        <li>✓ In stock · {listing.stock} units</li>
        <li>✓ Store open · {listing.store.hours}</li>
        <li>✓ Item reserved after you tap Reserve</li>
        <li>✓ ~{listing.store.prepMins} minutes estimated preparation</li>
      </ul>
    </div>
  )
}

/* ── Hold for me panel ──────────────────────────────────── */
export function HoldForMe({ until = '7:45 PM', windowStr = '7:00 – 7:45 PM' }) {
  const { toast } = useApp()
  return (
    <div className="nb-card p-5">
      <h3 className="text-h5 font-bold flex items-center gap-2">
        ⏳ Hold for me
        <ReserveBadge />
      </h3>
      <p className="text-body-sm text-neutral-500 mt-1">
        Not ready to order? The store keeps it aside for a short window.
      </p>
      <div className="mt-3 text-body-sm text-neutral-700 space-y-1">
        <p>
          Reserved until: <strong className="font-data">{until}</strong>
        </p>
        <p>
          Pickup window: <strong className="font-data">{windowStr}</strong>
        </p>
      </div>
      <Button
        variant="reserve"
        size="md"
        className="mt-4 w-full"
        onClick={() => toast({ kind: 'success', title: 'Item held for you', body: `Pick up before ${until}.` })}
      >
        Hold for me
      </Button>
    </div>
  )
}

/* ── Category tile ──────────────────────────────────────── */
export function CategoryTile({ categoryId, to }: { categoryId: string; to?: string }) {
  const cat = categoryById(categoryId)
  const navigate = useNavigate()
  if (!cat)
    return (
      <button
        onClick={() => navigate(to ?? `/search?category=${categoryId}`)}
        className="flex flex-col items-center gap-2 group min-h-touch"
      >
        <span className="w-[72px] h-[72px] lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center bg-neutral-100 text-neutral-500">🛍️</span>
        <span className="text-[13px] font-semibold text-neutral-700">{categoryId}</span>
      </button>
    )
  return (
    <button
      onClick={() => navigate(to ?? `/search?category=${categoryId}`)}
      className="flex flex-col items-center gap-2 group min-h-touch"
    >
      <span
        className="w-[72px] h-[72px] lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-fast"
        style={{ background: cat.tint, color: cat.accent }}
      >
        <CategoryIcon category={cat.id} size={31} />
      </span>
      <span className="text-[13px] font-semibold text-neutral-700">{cat.name}</span>
    </button>
  )
}

/* ── Mini store row ─────────────────────────────────────── */
export function StoreRow({ storeId }: { storeId: string }) {
  const store = getStore(storeId)
  const dist = storeDistance(store)
  return (
    <Link
      to={`/store/${storeId}`}
      className="nb-card flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover:shadow-medium transition-shadow duration-normal min-h-touch min-w-0 w-full overflow-hidden"
    >
      <span
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: categoryById(store.category)?.tint, color: categoryById(store.category)?.accent }}
      >
        <CategoryIcon category={store.category} size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-body font-bold text-neutral-900 truncate flex items-center gap-1.5">
          {store.name}
          {store.verified && <ShieldCheck size={15} className="text-success-500" />}
        </p>
        <p className="text-[13px] font-medium text-neutral-500">
          ★ {store.rating} · 📍 {formatKm(dist)}
        </p>
      </div>
      <span className={`text-[12px] font-semibold whitespace-nowrap ${store.open ? 'text-success-600' : 'text-neutral-400'}`}>
        {store.open ? '● Open' : `Opens ${store.opensAt}`}
      </span>
      <ChevronRight size={18} className="text-neutral-300 shrink-0 hidden sm:block" />
    </Link>
  )
}

/* ── Quiet stylized map ─────────────────────────────────── */
export function NearbyMap({
  stores,
  selectedId,
  onSelect,
  height = 320,
  route,
}: {
  stores: Store[]
  selectedId?: string
  onSelect?: (id: string) => void
  height?: number
  route?: boolean
}) {
  const lats = stores.map((s) => s.lat)
  const lngs = stores.map((s) => s.lng)
  const minLa = Math.min(...lats, 28.5921) - 0.002
  const maxLa = Math.max(...lats, 28.5921) + 0.002
  const minLo = Math.min(...lngs, 77.046) - 0.002
  const maxLo = Math.max(...lngs, 77.046) + 0.002
  const project = (la: number, lo: number) => ({
    x: 40 + ((lo - minLo) / (maxLo - minLo)) * 520,
    y: 30 + (1 - (la - minLa) / (maxLa - minLa)) * (height - 60),
  })
  const me = project(28.5921, 77.046)

  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 bg-[#F8FAFC]" style={{ height }}>
      <svg viewBox={`0 0 600 ${height}`} className="w-full h-full" role="img" aria-label="Map of nearby stores">
        {/* quiet street grid */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={'h' + i} x1="0" y1={i * (height / 7)} x2="600" y2={i * (height / 7)} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={'v' + i} x1={i * 75} y1="0" x2={i * 75} y2={height} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {/* park block */}
        <rect x="180" y={height * 0.55} width="140" height="90" rx="14" fill="#DCFCE7" opacity="0.55" />
        {/* water block */}
        <rect x="430" y="40" width="120" height="70" rx="14" fill="#E0F2FE" opacity="0.7" />
        {/* active route */}
        {route &&
          stores.map((s) => {
            const p = project(s.lat, s.lng)
            return (
              <line
                key={'r' + s.id}
                x1={me.x}
                y1={me.y}
                x2={p.x}
                y2={p.y}
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                opacity="0.5"
              />
            )
          })}
        {/* customer pin */}
        <g transform={`translate(${me.x} ${me.y})`}>
          <circle r="9" fill="#0F172A" />
          <circle r="3.5" fill="#fff" />
          <text y="26" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F172A">
            You
          </text>
        </g>
        {/* store pins */}
        {stores.map((s) => {
          const p = project(s.lat, s.lng)
          const selected = s.id === selectedId
          return (
            <g
              key={s.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onSelect?.(s.id)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              <circle
                r={selected ? 13 : 10}
                fill={selected ? '#1D4ED8' : '#2563EB'}
                stroke="#fff"
                strokeWidth="3"
                opacity={s.open ? 1 : 0.45}
              />
              <text y="-18" textAnchor="middle" fontSize="13">
                🏪
              </text>
              {selected && (
                <text y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D4ED8">
                  {s.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Generic option card used in checkout ───────────────── */
export function OptionRow({
  active,
  onClick,
  title,
  sub,
  right,
  accent,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  title: React.ReactNode
  sub?: React.ReactNode
  right?: React.ReactNode
  accent?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-fast min-h-touch disabled:opacity-50 disabled:cursor-not-allowed ${
        active ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-200'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          active ? 'border-primary-500' : 'border-neutral-400'
        }`}
      >
        {active && <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-body font-semibold text-neutral-900 block" style={{ color: accent }}>
          {title}
        </span>
        {sub && <span className="text-[13px] text-neutral-500 block mt-0.5">{sub}</span>}
      </span>
      {right && <span className="text-body-sm font-bold text-neutral-800 font-data">{right}</span>}
    </button>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// re-export for convenience
export { ShoppingCart, StoreIcon, Heart, Clock, ProductCardSkeleton, X, Minus, Plus }
