'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFulfillment, useAddToCart, useCreateReservation, useToggleWishlist, useSession, type FulfillmentOption } from '@nearbuy/api'
import { NearBuyAvailabilityCard, Button, QuantityStepper, Card, s, FieldError, Input, Label } from '@nearbuy/ui'

export function PurchasePanel({ productId, slug, name }: { productId: string; slug: string; name: string }) {
  const router = useRouter()
  const { user, checked } = useSession()
  const [qty, setQty] = React.useState(1)
  const [selected, setSelected] = React.useState<FulfillmentOption | null>(null)
  const [window_, setWindow] = React.useState('Today 18:00–19:00')
  const [err, setErr] = React.useState<string | undefined>()
  const { data, isLoading } = useFulfillment(productId, qty)
  const add = useAddToCart()
  const reserve = useCreateReservation()
  const wish = useToggleWishlist()

  const options = data?.options ?? []
  const isPickup = selected && (selected.method === 'NEARBY_PICKUP' || selected.method === 'RESERVE_AND_PICKUP')

  function requireLogin(): boolean {
    if (!checked) return true
    if (!user) {
      router.push('/login')
      return true
    }
    return false
  }

  async function onAdd() {
    if (requireLogin()) return
    setErr(undefined)
    try {
      await add.mutateAsync({ productId, qty })
      router.push('/cart')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function onReserve() {
    if (requireLogin() || !selected?.storeId) return
    setErr(undefined)
    try {
      const r = await reserve.mutateAsync({
        items: [{ productId, storeId: selected.storeId, qty }],
        pickupWindow: window_,
      })
      router.push(`/reservations?created=${r.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink">{s('product.qty', 'Quantity')}</span>
        <QuantityStepper qty={qty} onChange={setQty} max={10} />
      </div>

      <NearBuyAvailabilityCard
        options={options}
        selected={selected?.method}
        loading={isLoading}
        onSelect={(opt) => {
          setSelected(opt)
          setErr(undefined)
        }}
      />

      {isPickup && (
        <div>
          <Label htmlFor="pw">{s('reserve.window', 'Pickup window')}</Label>
          <Input id="pw" value={window_} onChange={(e) => setWindow(e.target.value)} placeholder="Today 18:00–19:00" />
        </div>
      )}

      <FieldError message={err} />

      {isPickup ? (
        <Button variant="accent" size="lg" loading={reserve.isPending} onClick={() => void onReserve()}>
          {s('reserve.cta', 'Reserve & Pickup')}
        </Button>
      ) : (
        <Button size="lg" loading={add.isPending} onClick={() => void onAdd()}>
          {s('product.addToCart', 'Add to cart')}
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => {
          if (requireLogin()) return
          wish.mutate({ productId, on: true })
        }}
      >
        ♡ {s('product.wishlist', 'Wishlist')}
      </Button>
      <p className="text-center text-xs text-ink-muted">{s('product.stockNote', 'Availability rendered live from store inventory — holds prevent overselling.')}</p>
    </Card>
  )
}

