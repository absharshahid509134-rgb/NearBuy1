'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, LoadingBlock, StatusBadge, s, formatINR, SectionHeader } from '@nearbuy/ui'

interface AdminOrderRow { id: string; number: string; status: string; total: string | number; fulfillmentMethod: string; createdAt: string; user?: { name: string } | null }
interface AdminResRow { id: string; code: string; status: string; pickupWindow: string; user?: { name: string } | null; store?: { name: string } | null }

export default function AdminOrders() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const [orders, setOrders] = React.useState<AdminOrderRow[]>([])
  const [res, setRes] = React.useState<AdminResRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
    if (!checked || !user) return
    void Promise.all([
      fetch('/api/v1/admin/orders', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/v1/admin/reservations', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([o, r]) => {
      setOrders((o.data ?? []) as AdminOrderRow[])
      setRes((r.data ?? []) as AdminResRow[])
      setLoading(false)
    })
  }, [checked, user, router])

  if (!checked || loading) return <LoadingBlock />

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-2">
      <section>
        <SectionHeader title={s('nav.orders', 'Orders')} />
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Card className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-primary-600">{o.number}</p>
                  <p className="text-ink-secondary">{o.fulfillmentMethod?.replaceAll('_', ' ')} · {o.user?.name ?? ''}</p>
                </div>
                <StatusBadge status={o.status} />
                <span className="font-bold">{formatINR(Number(o.total))}</span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionHeader title={s('nav.reservations', 'Reservations')} />
        <ul className="space-y-2">
          {res.map((r) => (
            <li key={r.id}>
              <Card className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-reserve">{r.code}</p>
                  <p className="text-ink-secondary">{r.store?.name ?? ''} · {r.user?.name ?? ''} · {r.pickupWindow}</p>
                </div>
                <StatusBadge status={r.status} />
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

