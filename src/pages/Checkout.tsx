import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Bike, CheckCircle2, PackageCheck, ShoppingBag, Store as StoreIcon } from 'lucide-react'
import { PICKUP_WINDOWS } from '../data/catalog'
import { getProduct, getStore } from '../lib/geo'
import { api } from '../auth/api'
import { orderFromApi, reservationFromApi, type ApiOrder, type ApiReservation } from '../store/serverCommerce'
import { formatINR } from '../lib/format'
import { OptionRow, ProductVisual } from '../components/commerce'
import { Button, Input, SectionHeading } from '../components/ui'
import { useApp } from '../store/AppContext'

/**
 * Checkout — prices, fees and stock are computed by the server (quote),
 * never by the client. Multi-store carts create one order per store.
 *
 * Retry safety: every order submission carries an idempotency key. A
 * double-click, refresh or network timeout re-sends the same key and the
 * server returns the original orders instead of creating duplicates. A key
 * is consumed by a successful order, so a genuinely new identical order
 * later gets a fresh key.
 *
 * Payments: this build runs in Test Mode — UPI/Card record a simulated
 * authorization (no money moves) and COD is paid at handover. The UI says
 * so explicitly; a real gateway would plug into the payments module.
 */

type Mode = 'delivery' | 'pickup' | 'reserve'

interface QuoteGroup {
  storeId: string
  storeName: string
  subtotal: number
  deliveryFee: number
  distanceKm: number
  items: { productId: string; storeId: string; qty: number; name: string; unitPrice: number }[]
}
interface Quote {
  groups: QuoteGroup[]
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  fulfillment: string
}

const ATTEMPT_STORAGE = 'nearbuy:checkout-attempt'
interface CheckoutAttempt {
  fingerprint: string
  key: string
  at: number
}

function readAttempt(): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_STORAGE)
    return raw ? (JSON.parse(raw) as CheckoutAttempt) : null
  } catch {
    return null
  }
}
function writeAttempt(a: CheckoutAttempt | null) {
  try {
    if (a) sessionStorage.setItem(ATTEMPT_STORAGE, JSON.stringify(a))
    else sessionStorage.removeItem(ATTEMPT_STORAGE)
  } catch {
    /* storage unavailable — idempotency degrades to single-shot, still safe */
  }
}

export default function Checkout() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { cart, placeOrder, placeReservation, clearCart, toast } = useApp()
  const requestedMode = params.get('mode')
  const [mode, setMode] = useState<Mode>(
    requestedMode === 'pickup' || requestedMode === 'reserve' ? requestedMode : 'delivery',
  )
  const [windowStr, setWindowStr] = useState(PICKUP_WINDOWS[1])
  const [pay, setPay] = useState<'upi' | 'card' | 'cod'>('upi')
  const [address, setAddress] = useState('H-14, Sector 22, Dwarka, Delhi — 110077')
  const [placed, setPlaced] = useState<null | { ids: string[]; code?: string; serverId?: string }>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const submitting = useRef(false)

  const fulfillmentFor = (m: Mode) => (m === 'pickup' ? 'NEARBY_PICKUP' : 'LOCAL_DELIVERY')

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

  const canDeliver = groups.length > 0 && groups.every((g) => g.store.localDelivery)
  const canPickup = groups.length > 0 && groups.every((g) => g.store.pickup)
  const canReserve = groups.length === 1 && canPickup
  useEffect(() => {
    if (mode === 'reserve' && !canReserve) setMode(canDeliver ? 'delivery' : 'pickup')
    if (mode === 'delivery' && !canDeliver && canPickup) setMode('pickup')
    if (mode === 'pickup' && !canPickup && canDeliver) setMode('delivery')
  }, [mode, canReserve, canPickup, canDeliver])

  // ── Server quote: the numbers shown are the numbers the server will charge
  const cartFingerprint = useMemo(
    () =>
      JSON.stringify(
        cart.map(({ productId, storeId, qty }) => [productId, storeId, qty]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
    [cart],
  )
  useEffect(() => {
    if (!cart.length) {
      setQuote(null)
      return
    }
    let live = true
    const items = cart.map(({ productId, storeId, qty }) => ({ productId, storeId, qty }))
    api
      .post<Quote>('/checkout/quote', { items, fulfillment: fulfillmentFor(mode) })
      .then((q) => {
        if (live) setQuote(q)
      })
      .catch(() => {
        // quote is advisory; place() re-validates server-side
        if (live) setQuote(null)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartFingerprint, mode])

  const perStoreFee = (storeId: string): number | null =>
    quote?.groups.find((g) => g.storeId === storeId)?.deliveryFee ?? null

  const subtotal = quote?.subtotal ?? cart.reduce((s, l) => s + l.price * l.qty, 0)
  const fee = mode === 'delivery' ? (quote?.deliveryFee ?? 30 * groups.length) : 0
  const total = quote?.total ?? subtotal + fee
  const quotePending = cart.length > 0 && !quote && !busy

  async function place() {
    if (submitting.current) return
    if (mode === 'delivery' && !address.trim()) {
      setError('Add a delivery address so the rider knows where to find you.')
      return
    }
    if (mode === 'reserve' && !canReserve) {
      setError('Reserve & Pickup is available for one store at a time.')
      return
    }
    submitting.current = true
    setBusy(true)
    setError('')
    const items = cart.map(({ productId, storeId, qty }) => ({ productId, storeId, qty }))
    const fulfillment = fulfillmentFor(mode)
    try {
      if (mode === 'reserve') {
        const reservation = await api.post<ApiReservation>('/checkout/reservations', { items, pickupWindow: windowStr })
        placeReservation(reservationFromApi(reservation))
        setPlaced({ ids: [reservation.code], code: reservation.code, serverId: reservation.id })
      } else {
        // Idempotency key: reuse across retries of the same attempt (same
        // cart + mode + payment + address within 3 minutes); consumed on
        // success so the next identical order is a fresh attempt.
        const fingerprint = JSON.stringify({
          cart: cartFingerprint,
          fulfillment,
          pay,
          address: mode === 'delivery' ? address.trim() : null,
        })
        const existing = readAttempt()
        const reuse = existing && existing.fingerprint === fingerprint && Date.now() - existing.at < 3 * 60_000
        const idempotencyKey = reuse ? existing.key : crypto.randomUUID()
        const result = await api.post<{ orders: ApiOrder[] }>('/checkout/orders', {
          items,
          fulfillment,
          paymentMethod: mode === 'pickup' && pay === 'cod' ? 'PAY_AT_STORE' : pay.toUpperCase(),
          ...(mode === 'delivery' ? { addressLine: address.trim() } : {}),
          idempotencyKey,
        })
        if (!result.orders.length) throw new Error('No order was created. Please try again.')
        writeAttempt(null)
        result.orders.forEach((order) => placeOrder(orderFromApi(order)))
        setPlaced({ ids: result.orders.map((order) => order.number) })
      }
      clearCart()
      window.scrollTo({ top: 0, behavior: 'instant' })
      toast({ kind: 'success', title: mode === 'reserve' ? 'Reservation requested.' : 'Order placed.', body: 'Follow the latest status in your account.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not place your order. Please try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (placed) {
    return (
      <div className="nb-container py-16 max-w-lg mx-auto text-center space-y-6">
        <div className="animate-pop inline-flex w-20 h-20 rounded-full bg-success-50 items-center justify-center">
          <CheckCircle2 size={48} className="text-success-500" />
        </div>
        <h1 className="text-m-h1 lg:text-h1">
          {placed.code ? 'Reservation requested.' : placed.ids.length > 1 ? 'Orders placed.' : 'Order placed.'}
        </h1>
        {placed.code ? (
          <div className="nb-card p-6 bg-reservebg border-reserveborder space-y-4">
            <p className="text-body text-neutral-700">Your pickup code</p>
            <p className="text-h1 font-extrabold font-data text-[#6D28D9]">{placed.code}</p>
            <div className="inline-block bg-white p-3 rounded-lg border border-reserveborder">
              <QRCodeSVG value={`nearbuy://pickup/${placed.serverId}/${placed.code}`} size={140} />
            </div>
            <p className="text-body-sm text-neutral-600">
              Pickup window <strong>{windowStr}</strong> · show this QR after the store confirms
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-body text-neutral-600">
              {mode === 'pickup' ? 'The store will confirm and prepare it for collection.' : 'The store will prepare your order, then a rider will bring it to you.'}
            </p>
            <p className="text-caption text-neutral-400">Test Mode — no real payment was taken.</p>
          </div>
        )}
        <div className="text-body-sm text-neutral-500"><span>{placed.ids.length > 1 ? 'Your store references' : 'Reference'}</span><div className="mt-2 flex flex-wrap justify-center gap-2">{placed.ids.map((id) => <span key={id} className="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 font-data font-bold">{id}</span>)}</div></div>
        <div className="flex gap-3 justify-center">
          <Button size="lg" onClick={() => navigate(placed.code ? '/reservations' : '/orders')}>
            {placed.code ? 'My Reservations' : 'Track Order'}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/customer')}>
            Keep shopping
          </Button>
        </div>
      </div>
    )
  }

  if (!cart.length) {
    return (
      <div className="nb-container py-20 text-center space-y-4">
        <div className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-primary-50 text-primary-500"><ShoppingBag size={33} strokeWidth={1.5} /></div>
        <h1 className="text-h4 font-bold">Nothing to check out</h1>
        <Button onClick={() => navigate('/nearby-now')}>Find something nearby</Button>
      </div>
    )
  }

  return (
    <div className="nb-container py-6 lg:py-10 space-y-8">
      <h1 className="text-m-h1 lg:text-h1">Checkout</h1>
      <div className="grid lg:grid-cols-[1fr,380px] gap-8 items-start">
        <div className="space-y-8">
          {/* fulfillment */}
          <section>
            <SectionHeading title="How do you want to get it?" sub="Per-store fulfilment — NearBuy coordinates the rest." />
            <div className="space-y-2.5">
              <OptionRow
                active={mode === 'delivery'}
                onClick={() => setMode('delivery')}
                disabled={!canDeliver}
                title={<span className="inline-flex items-center gap-2"><Bike size={18} /> Local delivery</span>}
                sub={canDeliver ? `Each store sends its own parcel · server-quoted fee per store` : 'Not available for every store in this cart'}
                right={mode === 'delivery' && quote ? formatINR(quote.deliveryFee) : `from ${formatINR(30 * groups.length)}`}
              />
              <OptionRow
                active={mode === 'pickup'}
                onClick={() => setMode('pickup')}
                disabled={!canPickup}
                title={<span className="inline-flex items-center gap-2"><StoreIcon size={18} /> Pickup today</span>}
                sub={canPickup ? 'Free · each store confirms when it is ready' : 'Not available for every store in this cart'}
                right="FREE"
              />
              <OptionRow
                active={mode === 'reserve'}
                onClick={() => setMode('reserve')}
                disabled={!canReserve}
                title={<span className="inline-flex items-center gap-2"><PackageCheck size={18} /> Reserve & Pickup</span>}
                sub={canReserve ? 'Request a hold, collect in your chosen window with a QR code' : 'Reserve items from one store at a time'}
                right="FREE"
                accent="#7C3AED"
              />
            </div>
            {mode === 'reserve' && (
              <div className="mt-4 rounded-xl bg-reservebg border border-reserveborder p-4">
                <p className="text-body-sm font-semibold text-[#6D28D9] mb-2">Pickup window</p>
                <div className="flex flex-wrap gap-2">
                  {PICKUP_WINDOWS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowStr(w)}
                      className={`px-3.5 h-10 rounded-full text-body-sm font-semibold min-h-touch ${
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

          {/* address */}
          {mode === 'delivery' && (
            <section>
              <SectionHeading title="Delivering to" />
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </section>
          )}

          {/* stores in this order */}
          <section>
            <SectionHeading title="Stores in your cart" sub={`${groups.length} ${groups.length === 1 ? 'store' : 'stores'} · each store prepares its own items`} />
            <div className="space-y-3">
              {groups.map((g) => {
                const qg = quote?.groups.find((x) => x.storeId === g.store.id)
                return (
                  <div key={g.store.id} className="nb-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-body-sm font-bold">🏪 {g.store.name}</p>
                      <span className="text-caption text-neutral-500">{g.store.open ? 'Open' : 'Closed'}</span>
                    </div>
                    {g.lines.map((l) => {
                      const p = getProduct(l.productId)
                      const unit = qg?.items.find((i) => i.productId === l.productId)?.unitPrice ?? l.price
                      return (
                        <div key={l.productId} className="flex items-center gap-3 py-2">
                          <ProductVisual product={p} className="w-12 h-12 aspect-none rounded-md" />
                          <span className="flex-1 text-body-sm truncate">{p.name} × {l.qty}</span>
                          <span className="font-data font-semibold">{formatINR(unit * l.qty)}</span>
                        </div>
                      )
                    })}
                    {mode === 'delivery' && perStoreFee(g.store.id) !== null && (
                      <div className="flex justify-between text-body-sm pt-2 border-t border-neutral-100">
                        <span className="text-neutral-500">Local delivery from this store</span>
                        <span className="font-data font-semibold">{formatINR(perStoreFee(g.store.id)!)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* payment */}
          {mode === 'reserve' ? (
            <p className="rounded-lg border border-reserveborder bg-reservebg p-4 text-body-sm text-[#6D28D9]">
              No payment now. The store will confirm your hold before you visit.
            </p>
          ) : (
            <section>
              <SectionHeading title="Payment" />
              <div className="space-y-2.5">
                <OptionRow active={pay === 'upi'} onClick={() => setPay('upi')} title="UPI" sub="GPay / PhonePe / Paytm" />
                <OptionRow active={pay === 'card'} onClick={() => setPay('card')} title="Card" sub="Visa · Mastercard · RuPay" />
                <OptionRow active={pay === 'cod'} onClick={() => setPay('cod')} title="Pay on pickup / delivery" sub="Cash or UPI at handover" />
              </div>
              <p className="text-caption text-neutral-500 mt-3">
                Test Mode — no real payment is taken on this instance. UPI and Card record a simulated
                authorization; “pay on handover” is settled in cash when you receive it.
              </p>
            </section>
          )}
        </div>

        {/* summary */}
        <aside className="nb-card p-6 space-y-3 lg:sticky lg:top-24">
          <SectionHeading title="Summary" />
          {quotePending && <p className="text-caption text-neutral-400">Confirming prices with the stores…</p>}
          <div className="flex justify-between text-body-sm">
            <span className="text-neutral-500">Subtotal {quote ? '(server)' : ''}</span>
            <span className="font-data font-semibold">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-body-sm">
            <span className="text-neutral-500">
              {mode === 'delivery' ? (groups.length > 1 ? `Delivery · ${groups.length} stores × ${formatINR(perStoreFee(groups[0].store.id) ?? 30)}` : 'Local delivery') : 'Pickup'}
            </span>
            <span className={`font-data font-semibold ${fee ? '' : 'text-success-600'}`}>
              {fee ? formatINR(fee) : 'FREE'}
            </span>
          </div>
          <div className="flex justify-between text-h5 pt-2 border-t border-neutral-100">
            <span>{mode === 'reserve' ? 'Estimated value' : 'Total'}</span>
            <span className="font-data">{formatINR(total)}</span>
          </div>
          {error && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-body-sm text-error-700">{error}</p>}
          <Button size="xl" className="w-full mt-2" disabled={busy || (!canPickup && !canDeliver)} loading={busy} onClick={() => void place()}>
            {busy ? 'Placing your request…' : mode === 'reserve' ? 'Request Reservation' : groups.length > 1 ? 'Place Orders' : 'Place Order'}
          </Button>
          <p className="text-caption text-neutral-400 text-center">
            {mode === 'reserve'
              ? 'The store will confirm your request before your pickup window.'
              : 'Prices are computed by the server; retries of the same attempt never create duplicate orders.'}
          </p>
        </aside>
      </div>
    </div>
  )
}
