'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart, useAddresses, useAddAddress, useQuote, usePlaceOrder, useSession, type CheckoutItem } from '@nearbuy/api'
import { PAYMENT_METHODS, FULFILLMENT_METHODS } from '@nearbuy/types'
import { addressSchema } from '@nearbuy/validation'
import { Card, Button, Input, Label, FieldError, LoadingBlock, EmptyState, s, formatINR, Badge } from '@nearbuy/ui'

const STEPS = ['address', 'fulfillment', 'payment'] as const
type Step = (typeof STEPS)[number]

export default function CheckoutPage() {
  const router = useRouter()
  const { user, checked } = useSession()
  const { data: cart, isLoading } = useCart()
  const { data: addresses } = useAddresses()
  const addAddress = useAddAddress()
  const quote = useQuote()
  const place = usePlaceOrder()
  const [step, setStep] = React.useState<Step>('address')
  const [addressId, setAddressId] = React.useState<string | undefined>()
  const [fulfillment, setFulfillment] = React.useState<string>('STANDARD_DELIVERY')
  const [payment, setPayment] = React.useState<string>('UPI')
  const [coupon, setCoupon] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [orderError, setOrderError] = React.useState<string | undefined>()

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])

  if (!checked || isLoading) return <LoadingBlock />
  if (!cart || cart.items.length === 0) {
    return <div className="nb-container py-10"><EmptyState title={s('cart.empty', 'Your cart is empty')} action={<Link href="/search"><Button>{s('nav.search', 'Search')}</Button></Link>} /></div>
  }

  const items: CheckoutItem[] = cart.items
    .filter((i) => i.available && i.storeId)
    .map((i) => ({ productId: i.productId, storeId: i.storeId as string, qty: i.qty }))

  async function onAddAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = addressSchema.safeParse(Object.fromEntries(fd.entries()))
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] ?? 'form', i.message])))
      return
    }
    setErrors({})
    const a = await addAddress.mutateAsync({ ...parsed.data, isDefault: true })
    setAddressId(a.id)
  }

  async function onGetQuote() {
    setOrderError(undefined)
    try {
      await quote.mutateAsync({ items, fulfillment, paymentMethod: payment, addressId, couponCode: coupon || undefined })
      setStep('payment')
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onPlaceOrder() {
    setOrderError(undefined)
    try {
      const r = await place.mutateAsync({ items, fulfillment, paymentMethod: payment, addressId, couponCode: coupon || undefined })
      const first = r.orders?.[0]
      router.push(first ? `/orders/${first.id}` : '/orders')
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : String(e))
    }
  }

  const q = quote.data

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-[1fr,360px]">
      <section>
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s('checkout.title', 'Checkout')}</h1>
        <ol className="mb-6 flex gap-2" aria-label={s('checkout.steps', 'Checkout steps')}>
          {STEPS.map((st, i) => (
            <li key={st} className={`rounded-full px-3 py-1 text-sm font-bold ${step === st ? 'bg-primary-600 text-white' : i < STEPS.indexOf(step) ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-ink-muted'}`}>
              {i + 1}. {st}
            </li>
          ))}
        </ol>

        {step === 'address' && (
          <Card className="flex flex-col gap-4 p-5">
            <p className="font-extrabold text-ink">{s('checkout.deliveryAddress', 'Delivery address')}</p>
            {(addresses ?? []).map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${addressId === a.id ? 'border-primary-600 bg-primary-50' : 'border-border'}`}>
                <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-primary-600" />
                <span className="text-sm">
                  <span className="block font-bold text-ink">{a.label} · {a.name}</span>
                  <span className="text-ink-secondary">{a.line1}, {a.area}, {a.city} {a.pincode} · {a.phone}</span>
                </span>
              </label>
            ))}
            <details>
              <summary className="cursor-pointer text-sm font-bold text-primary-600">{s('checkout.addAddress', 'Add new address')}</summary>
              <form onSubmit={(e) => void onAddAddress(e)} className="mt-3 grid gap-3 sm:grid-cols-2" noValidate>
                <div><Label htmlFor="label">{s('address.label', 'Label')}</Label><Input id="label" name="label" placeholder="Home" required /><FieldError message={errors.label} /></div>
                <div><Label htmlFor="name">{s('auth.name', 'Full name')}</Label><Input id="name" name="name" required /><FieldError message={errors.name} /></div>
                <div><Label htmlFor="phone">{s('auth.phone', 'Phone')}</Label><Input id="phone" name="phone" required /><FieldError message={errors.phone} /></div>
                <div><Label htmlFor="pincode">{s('address.pincode', 'Pincode')}</Label><Input id="pincode" name="pincode" required /><FieldError message={errors.pincode} /></div>
                <div className="sm:col-span-2"><Label htmlFor="line1">{s('address.line1', 'Address line 1')}</Label><Input id="line1" name="line1" required /><FieldError message={errors.line1} /></div>
                <div><Label htmlFor="area">{s('address.area', 'Area')}</Label><Input id="area" name="area" required /><FieldError message={errors.area} /></div>
                <div><Label htmlFor="city">{s('address.city', 'City')}</Label><Input id="city" name="city" required /><FieldError message={errors.city} /></div>
                <div><Label htmlFor="state">{s('address.state', 'State')}</Label><Input id="state" name="state" required /><FieldError message={errors.state} /></div>
                <div className="sm:col-span-2"><Button type="submit" variant="outline" loading={addAddress.isPending}>{s('checkout.saveContinue', 'Save & continue')}</Button></div>
              </form>
            </details>
            <Button size="lg" disabled={!addressId} onClick={() => setStep('fulfillment')}>{s('common.continue', 'Continue')}</Button>
          </Card>
        )}

        {step === 'fulfillment' && (
          <Card className="flex flex-col gap-3 p-5">
            <p className="font-extrabold text-ink">{s('checkout.fulfillment', 'How do you want to get it?')}</p>
            {FULFILLMENT_METHODS.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 ${fulfillment === m ? 'border-primary-600 bg-primary-50' : 'border-border'}`}>
                <input type="radio" checked={fulfillment === m} onChange={() => setFulfillment(m)} className="accent-primary-600" />
                <span className="text-sm font-bold text-ink">{m.replaceAll('_', ' ')}</span>
              </label>
            ))}
            <div className="mt-2">
              <Label htmlFor="coupon">{s('checkout.coupon', 'Coupon code')}</Label>
              <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="WELCOME10" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('address')}>{s('common.back', 'Back')}</Button>
              <Button size="lg" loading={quote.isPending} onClick={() => void onGetQuote()} disabled={items.length === 0}>{s('checkout.review', 'Review order')}</Button>
            </div>
            {items.length === 0 && <p className="text-xs font-semibold text-error-500">{s('checkout.noStoreItems', 'Items without a nearby store cannot be checked out.')}</p>}
          </Card>
        )}

        {step === 'payment' && (
          <Card className="flex flex-col gap-3 p-5">
            <p className="font-extrabold text-ink">{s('checkout.payment', 'Payment')}</p>
            {PAYMENT_METHODS.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 ${payment === m ? 'border-primary-600 bg-primary-50' : 'border-border'}`}>
                <input type="radio" checked={payment === m} onChange={() => setPayment(m)} className="accent-primary-600" />
                <span className="text-sm font-bold text-ink">{m.replaceAll('_', ' ')}</span>
              </label>
            ))}
            {q && (
              <div className="rounded-card bg-canvas p-4 text-sm">
                <div className="flex justify-between"><span>{s('cart.subtotal', 'Subtotal')}</span><span>{formatINR(q.subtotal)}</span></div>
                <div className="flex justify-between"><span>{s('checkout.fee', 'Delivery fee')}</span><span>{formatINR(q.deliveryFee)}</span></div>
                <div className="flex justify-between text-success-600"><span>{s('checkout.discount', 'Discount')}</span><span>−{formatINR(q.discount)}</span></div>
                <div className="mt-1 flex justify-between text-base font-extrabold"><span>{s('cart.total', 'Total')}</span><span>{formatINR(q.total)}</span></div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('fulfillment')}>{s('common.back', 'Back')}</Button>
              <Button size="lg" loading={place.isPending} onClick={() => void onPlaceOrder()}>{s('checkout.placeOrder', 'Place order')}</Button>
            </div>
          </Card>
        )}
        {orderError && <p role="alert" className="mt-3 rounded-card bg-error-50 p-2 text-sm font-semibold text-error-500">{orderError}</p>}
      </section>

      <aside>
        <Card className="sticky top-28 flex flex-col gap-2 p-5">
          <p className="text-sm font-extrabold uppercase tracking-wide text-ink-secondary">{s('cart.summary', 'Summary')}</p>
          {cart.items.map((i) => (
            <div key={i.id} className="flex justify-between text-sm">
              <span className="truncate pr-2 text-ink-secondary">{i.emoji} {i.name} × {i.qty}</span>
              <span className="font-semibold">{formatINR(i.lineTotal)}</span>
            </div>
          ))}
          <hr className="border-border" />
          <div className="flex justify-between text-base font-extrabold"><span>{s('cart.total', 'Total')}</span><span>{formatINR(q?.total ?? cart.subtotal)}</span></div>
          {q && q.discount > 0 && <Badge tone="success">{s('checkout.savings', 'You save')} {formatINR(q.discount)}</Badge>}
        </Card>
      </aside>
    </div>
  )
}
