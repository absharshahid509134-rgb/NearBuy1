'use client'
import * as React from 'react'
import Link from 'next/link'
import { useOrders, useSession } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, ErrorBlock, StatusBadge, s, formatINR } from '@nearbuy/ui'

export default function OrdersPage() {
  const { user, checked } = useSession()
  const { data, isLoading, error, refetch } = useOrders()

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>
  if (isLoading) return <LoadingBlock />
  if (error) return <div className="nb-container py-10"><ErrorBlock message={error.message} retry={() => void refetch()} /></div>

  return (
    <div className="nb-container py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s('nav.orders', 'Orders')}</h1>
      {!data || data.length === 0 ? (
        <EmptyState title={s('orders.empty', 'No orders yet')} hint={s('orders.emptyHint', 'When you order something, it will show up here with live tracking.')} action={<Link href="/search"><Button>{s('nav.search', 'Search')}</Button></Link>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`}>
                <Card className="flex flex-wrap items-center gap-4 p-4 hover:border-primary-300">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold text-primary-600">{o.number}</p>
                    <p className="text-sm text-ink-secondary">{o.fulfillmentMethod.replaceAll('_', ' ')} · {new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={o.status} />
                  <p className="w-28 text-right text-lg font-extrabold">{formatINR(Number(o.total))}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
