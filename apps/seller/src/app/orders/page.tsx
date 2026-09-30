'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useOrders, useOrderAction, useReservations, useReservationAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, StatusBadge, s, formatINR, SectionHeader } from '@nearbuy/ui'

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

export default function SellerOrders() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data: orders, refetch: refOrders, isLoading } = useOrders('seller')
  const { data: reservations, refetch: refRes } = useReservations('seller')
  const orderAction = useOrderAction()
  const resAction = useReservationAction()

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-2">
      <section>
        <SectionHeader title={s('seller.orderQueue', 'Order queue')} />
        <ul className="space-y-3">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
              <Card className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary-600">{o.number}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-ink-secondary">
                  {o.fulfillmentMethod.replaceAll('_', ' ')} · {formatINR(Number(o.total))} · {o.addressSnap ? Object.values(o.addressSnap).filter(Boolean).join(', ') : s('order.pickup', 'Store pickup')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(ORDER_ACTIONS[o.status] ?? []).map((a) => (
                    <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'primary'} loading={orderAction.isPending}
                      onClick={() => orderAction.mutate({ id: o.id, action: a }, { onSuccess: () => void refOrders() })}>
                      {a}
                    </Button>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionHeader title={s('seller.resQueue', 'Reservation queue')} />
        <ul className="space-y-3">
          {(reservations ?? []).map((r) => (
            <li key={r.id}>
              <Card className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-reserve">{r.code}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-ink-secondary">{r.pickupWindow} · {r.items?.map((i) => `${i.name}×${i.qty}`).join(', ')}</p>
                <p className="text-xs text-ink-muted">QR: <code>{r.qrPayload}</code></p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(RES_ACTIONS[r.status] ?? []).map((a) => (
                    <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'accent'} loading={resAction.isPending}
                      onClick={() => resAction.mutate({ id: r.id, action: a }, { onSuccess: () => void refRes() })}>
                      {a}
                    </Button>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
