'use client'
import * as React from 'react'
import Link from 'next/link'
import { useSellerMe, useOrders, useReservations, useOrderAction, useReservationAction, useReturns, useReturnAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, EmptyState, LoadingBlock, StatusBadge, Badge, s, formatINR, SectionHeader } from '@nearbuy/ui'

const ORDER_ACTIONS: Record<string, string[]> = {
  PLACED: ['Confirm', 'Reject'],
  CONFIRMED: ['Pack'],
  PACKED: ['Ready'],
  READY: ['Scan', 'Ship'],
  OUT_FOR_DELIVERY: ['Complete'],
}
const RES_ACTIONS: Record<string, string[]> = {
  REQUESTED: ['Confirm', 'Reject'],
  CONFIRMED: ['Pack'],
  PACKING: ['Ready'],
  READY_FOR_PICKUP: ['Scan'],
  CUSTOMER_ARRIVED: ['Complete'],
}
const RETURN_ACTIONS: Record<string, string[]> = {
  REQUESTED: ['Approve', 'Reject'],
  APPROVED: ['Schedule'],
  PICKUP_SCHEDULED: ['Pickup'],
  PICKED_UP: ['Receive'],
  RECEIVED: ['Inspect'],
  INSPECTION: ['Refund', 'Replace', 'Reject'],
}

export default function SellerDashboard() {
  useBootstrapSession()
  const { user, checked } = useSession()
  const { data: me, isLoading: meLoad } = useSellerMe()
  const { data: orders, refetch: refOrders } = useOrders('seller')
  const { data: reservations, refetch: refRes } = useReservations('seller')
  const { data: returns, refetch: refRet } = useReturns('seller')
  const orderAction = useOrderAction()
  const resAction = useReservationAction()
  const retAction = useReturnAction()

  if (!checked) return <LoadingBlock />
  if (!user) {
    return (
      <div className="nb-container py-10">
        <EmptyState
          title={s('seller.signIn', 'Seller sign in')}
          hint={s('seller.signInHint', 'Use your seller account (seller.sports@nearbuy.dev / Seller@123 in the demo).')}
          action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="nb-container py-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{s('seller.title', 'Seller Hub')}</h1>
        {me && <Badge tone={me.status === 'APPROVED' ? 'success' : 'warning'}>{me.status}</Badge>}
        <nav className="ml-auto flex gap-2">
          <Link href="/products"><Button variant="outline" size="sm">{s('seller.products', 'Products')}</Button></Link>
          <Link href="/inventory"><Button variant="outline" size="sm">{s('seller.inventory', 'Inventory')}</Button></Link>
          <Link href="/orders"><Button variant="outline" size="sm">{s('nav.orders', 'Orders')}</Button></Link>
          <Link href="/reservations"><Button variant="outline" size="sm">{s('nav.reservations', 'Reservations')}</Button></Link>
        </nav>
      </div>

      {meLoad ? <LoadingBlock /> : me && (
        <Card className="mb-6 p-5">
          <p className="text-lg font-extrabold text-ink">{me.businessName}</p>
          <p className="text-sm text-ink-secondary">★ {me.rating} · {me.stores?.length ?? 0} {s('seller.stores', 'stores')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {(me.stores ?? []).map((st) => (
              <li key={st.id}><Badge tone={st.verified ? 'accent' : 'neutral'}>{st.emoji ?? '🏪'} {st.name} · {st.area}</Badge></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ORDERS QUEUE */}
        <Card className="p-5">
          <SectionHeader title={s('seller.orderQueue', 'Order queue')} />
          <ul className="space-y-3">
            {(orders ?? []).slice(0, 6).map((o) => (
              <li key={o.id} className="rounded-card bg-canvas p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary-600">{o.number}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-ink-secondary">{o.fulfillmentMethod.replaceAll('_', ' ')} · {formatINR(Number(o.total))}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(ORDER_ACTIONS[o.status] ?? []).map((a) => (
                    <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'primary'} loading={orderAction.isPending}
                      onClick={() => { orderAction.mutate({ id: o.id, action: a }, { onSuccess: () => void refOrders() }) }}>
                      {a}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
            {(orders ?? []).length === 0 && <li className="text-sm text-ink-muted">{s('seller.noOrders', 'No open orders.')}</li>}
          </ul>
        </Card>

        {/* RESERVATION QUEUE */}
        <Card className="p-5">
          <SectionHeader title={s('seller.resQueue', 'Reservation queue')} />
          <ul className="space-y-3">
            {(reservations ?? []).slice(0, 6).map((r) => (
              <li key={r.id} className="rounded-card bg-canvas p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-reserve">{r.code}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-ink-secondary">{r.pickupWindow} · {r.items?.length ?? 0} {s('seller.items', 'items')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(RES_ACTIONS[r.status] ?? []).map((a) => (
                    <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'accent'} loading={resAction.isPending}
                      onClick={() => { resAction.mutate({ id: r.id, action: a }, { onSuccess: () => void refRes() }) }}>
                      {a}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
            {(reservations ?? []).length === 0 && <li className="text-sm text-ink-muted">{s('seller.noRes', 'No active reservations.')}</li>}
          </ul>
        </Card>

        {/* RETURNS */}
        <Card className="p-5">
          <SectionHeader title={s('return.title', 'Return or replace')} />
          <ul className="space-y-3">
            {(returns ?? []).slice(0, 6).map((r) => (
              <li key={r.id} className="rounded-card bg-canvas p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary-600">{r.number}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-ink-secondary">{r.orderNumber} · {r.resolution} · {r.reason.replaceAll('_', ' ')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(RETURN_ACTIONS[r.status] ?? []).map((a) => (
                    <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'primary'} loading={retAction.isPending}
                      onClick={() => { retAction.mutate({ id: r.id, action: a }, { onSuccess: () => void refRet() }) }}>
                      {a}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
            {(returns ?? []).length === 0 && <li className="text-sm text-ink-muted">{s('return.empty', 'No returns')}</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
