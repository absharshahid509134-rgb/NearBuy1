'use client'
import * as React from 'react'
import Link from 'next/link'
import { useWishlist, useToggleWishlist, useSearch, useSession } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, ProductCard, s, SectionHeader } from '@nearbuy/ui'

export default function WishlistPage() {
  const { user, checked } = useSession()
  const { data, isLoading } = useWishlist()
  const toggle = useToggleWishlist()
  const { data: catalog } = useSearch({ q: 'a', take: 48 })

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>
  if (isLoading) return <LoadingBlock />

  const items = (data as { items?: Array<{ id: string; productId: string }> })?.items ?? []
  const byId = new Map((catalog?.hits ?? []).map((h) => [h.productId, h]))

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('nav.wishlist', 'Wishlist')} action={<p className="text-xs text-ink-muted">{s('wishlist.alerts', 'Price drop & stock alerts on')}</p>} />
      {items.length === 0 ? (
        <EmptyState title={s('wishlist.empty', 'Nothing saved yet')} hint={s('wishlist.emptyHint', 'Tap ♡ on any product to track its price and nearby stock.')} action={<Link href="/search"><Button>{s('nav.search', 'Search')}</Button></Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((w) => {
            const hit = byId.get(w.productId)
            return (
              <div key={w.id} className="flex flex-col gap-2">
                {hit ? (
                  <ProductCard product={{ ...hit, id: hit.productId, bestStoreName: undefined }} />
                ) : (
                  <Card className="p-4 text-sm text-ink-muted">🛍️ {w.productId.slice(0, 8)}…</Card>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggle.mutate({ productId: w.productId, on: false })}>✕ {s('wishlist.remove', 'Remove')}</Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
