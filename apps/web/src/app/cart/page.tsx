'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart, useUpdateCartItem, useRemoveCartItem, useSession } from '@nearbuy/api'
import { Card, Button, QuantityStepper, PriceBlock, EmptyState, LoadingBlock, ErrorBlock, Badge, s, formatINR } from '@nearbuy/ui'

export default function CartPage() {
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading, error, refetch } = useCart()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()

  if (!checked) return <LoadingBlock />
  if (!user) {
    return (
      <div className="nb-container py-10">
        <EmptyState title={s('auth.signInRequired', 'Please sign in')} hint={s('auth.signInCart', 'Sign in to see your cart.')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} />
      </div>
    )
  }
  if (isLoading) return <LoadingBlock />
  if (error) return <div className="nb-container py-10"><ErrorBlock message={error.message} retry={() => void refetch()} /></div>
  if (!data || data.items.length === 0) {
    return (
      <div className="nb-container py-10">
        <EmptyState title={s('cart.empty', 'Your cart is empty')} hint={s('cart.emptyHint', 'Find what you need — it is probably nearby.')} action={<Link href="/search"><Button>{s('nav.search', 'Search')}</Button></Link>} />
      </div>
    )
  }

  const opt = data.optimizer
  const best = Math.min(opt.oneStore, opt.twoStores, opt.online)

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-[1fr,360px]">
      <section>
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s('nav.cart', 'Cart')} ({data.items.length})</h1>
        <ul className="flex flex-col gap-3">
          {data.items.map((it) => (
            <li key={it.id}>
              <Card className="flex flex-wrap items-center gap-4 p-4">
                <span aria-hidden className="text-4xl">{it.emoji}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${it.slug}`} className="font-bold text-ink hover:text-primary-600">{it.name}</Link>
                  <p className="text-sm text-ink-secondary">{it.brand}</p>
                  {it.storeName && (
                    <p className="mt-1 text-xs font-semibold text-success-600">
                      📍 {it.storeName} · {it.distanceKm} km
                    </p>
                  )}
                  {!it.available && <Badge tone="error" className="mt-1">{s('status.outOfStock', 'Out of stock')}</Badge>}
                </div>
                <QuantityStepper qty={it.qty} onChange={(n) => update.mutate({ id: it.id, qty: n })} max={it.available ? 20 : it.qty} />
                <div className="w-28 text-right">
                  <PriceBlock price={it.lineTotal} size="sm" />
                  <p className="text-xs text-ink-muted">{formatINR(it.unitPrice)} × {it.qty}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(it.id)} aria-label={s('cart.remove', 'Remove')}>✕</Button>
              </Card>
            </li>
          ))}
        </ul>

        {/* Cart intelligence */}
        <Card className="mt-6 border-accent-200 bg-accent-50 p-4">
          <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink">{s('cart.optimizer', 'Smart sourcing')}</p>
          <ul className="space-y-1 text-sm font-semibold text-ink-secondary">
            <li className={opt.oneStore === best ? 'text-success-600' : ''}>🏪 {s('cart.oneStore', 'All from one store')}: {formatINR(opt.oneStore)}</li>
            <li className={opt.twoStores === best ? 'text-success-600' : ''}>🏪🏪 {s('cart.twoStores', 'Split across two stores')}: {formatINR(opt.twoStores)}</li>
            <li className={opt.online === best ? 'text-success-600' : ''}>🚚 {s('cart.online', 'Ship from warehouse')}: {formatINR(opt.online)}</li>
          </ul>
          {opt.criteria?.length > 0 && <p className="mt-2 text-xs text-ink-muted">{opt.criteria.join(' · ')}</p>}
        </Card>
      </section>

      <aside>
        <Card className="sticky top-28 flex flex-col gap-3 p-5">
          <p className="text-sm font-extrabold uppercase tracking-wide text-ink-secondary">{s('cart.summary', 'Summary')}</p>
          <div className="flex justify-between text-sm"><span>{s('cart.subtotal', 'Subtotal')}</span><span className="font-bold">{formatINR(data.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>{s('cart.stores', 'Stores')}</span><span className="font-bold">{data.storeCount}</span></div>
          <hr className="border-border" />
          <div className="flex justify-between text-base font-extrabold"><span>{s('cart.total', 'Total')}</span><span>{formatINR(data.subtotal)}</span></div>
          <Button size="lg" onClick={() => router.push('/checkout')}>{s('checkout.cta', 'Checkout')}</Button>
          <p className="text-center text-xs text-ink-muted">{s('cart.priceNote', 'Final price is computed at checkout by the pricing engine.')}</p>
        </Card>
      </aside>
    </div>
  )
}

