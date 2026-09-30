'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useReservations, useReservationAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, StatusBadge, ReservationTicket, s, SectionHeader } from '@nearbuy/ui'

const RES_ACTIONS: Record<string, string[]> = {
  REQUESTED: ['Confirm', 'Reject'],
  CONFIRMED: ['Pack'],
  PACKING: ['Ready'],
  READY_FOR_PICKUP: ['Scan'],
  CUSTOMER_ARRIVED: ['Complete'],
}

export default function SellerReservations() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, refetch, isLoading } = useReservations('seller')
  const action = useReservationAction()

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('seller.resQueue', 'Reservation queue')} />
      <div className="grid gap-6 lg:grid-cols-2">
        {(data ?? []).map((r) => (
          <div key={r.id} className="flex flex-col gap-2">
            <ReservationTicket
              reservation={{
                code: r.code, status: r.status, qr: r.qrPayload, pickupWindow: r.pickupWindow,
                store: { name: r.store.name, area: r.store.area, address: r.store.address, phone: r.store.phone },
              }}
            />
            <Card className="flex flex-wrap gap-2 p-3">
              {(RES_ACTIONS[r.status] ?? []).map((a) => (
                <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : 'accent'} loading={action.isPending}
                  onClick={() => action.mutate({ id: r.id, action: a }, { onSuccess: () => void refetch() })}>
                  {a}
                </Button>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
