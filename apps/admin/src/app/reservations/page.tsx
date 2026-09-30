'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useReservations, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, LoadingBlock, StatusBadge, s, SectionHeader, Badge } from '@nearbuy/ui'

export default function AdminReservations() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading } = useReservations()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('nav.reservations', 'Reservations')} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((r) => (
          <li key={r.id}>
            <Card className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-reserve">{r.code}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-ink-secondary">{r.store.name} · {r.pickupWindow}</p>
              <Badge tone="reserve" className="mt-1">{s('reserve.expires', 'Expires')} {new Date(r.expiresAt).toLocaleTimeString()}</Badge>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
