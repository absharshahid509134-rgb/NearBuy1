'use client'
import * as React from 'react'
import Link from 'next/link'
import { useReservations, useReservationAction, useSession } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, ErrorBlock, StatusBadge, ReservationTicket, OrderStatusTimeline, s, Badge } from '@nearbuy/ui'

export default function ReservationsPage() {
  const { user, checked } = useSession()
  const { data, isLoading, error, refetch } = useReservations()
  const action = useReservationAction()

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>
  if (isLoading) return <LoadingBlock />
  if (error) return <div className="nb-container py-10"><ErrorBlock message={error.message} retry={() => void refetch()} /></div>

  const rows = data ?? []

  return (
    <div className="nb-container py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s('nav.reservations', 'Reservations')}</h1>
      {rows.length === 0 ? (
        <EmptyState title={s('reserve.empty', 'No reservations')} hint={s('reserve.emptyHint', 'Reserve an item from a nearby store and it will wait for you.')} action={<Link href="/search?fulfillment=RESERVE_AND_PICKUP"><Button>{s('reserve.findItems', 'Find reservable items')}</Button></Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {rows.map((r) => {
            const active = ['REQUESTED', 'CONFIRMED', 'PACKING', 'READY_FOR_PICKUP'].includes(r.status)
            return (
              <div key={r.id} className="flex flex-col gap-3">
                <ReservationTicket
                  reservation={{
                    code: r.code, status: r.status, qr: r.qrPayload, pickupWindow: r.pickupWindow,
                    store: { name: r.store.name, area: r.store.area, address: r.store.address, phone: r.store.phone },
                  }}
                />
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <StatusBadge status={r.status} />
                    <Badge tone="reserve">{s('reserve.expires', 'Expires')} {new Date(r.expiresAt).toLocaleTimeString()}</Badge>
                  </div>
                  <OrderStatusTimeline status={r.status} kind="reservation" />
                  {active && (
                    <Button variant="destructive" size="sm" className="mt-3" onClick={() => action.mutate({ id: r.id, action: 'Cancel' })}>
                      {s('reserve.cancel', 'Cancel reservation')}
                    </Button>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
