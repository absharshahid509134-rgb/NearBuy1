import { useEffect, useState } from 'react'
import { api } from '../../auth/api'
import { formatINR, dayTime } from '../../lib/format'
import { SectionHeading, StatCard, StatusBadge } from '../../components/ui'

/** Admin operations — every row comes from the persisted admin API
 * (/api/v1/admin/*), not from demo arrays. */

interface AdminOrderRow {
  id: string
  number: string
  status: string
  total: string | number
  createdAt: string
  fulfillmentMethod: string
  store: { name: string } | null
  user: { name: string }
  items: { name?: string; qty: number }[]
}
interface AdminReservationRow {
  id: string
  code: string
  status: string
  pickupWindow: string
  createdAt: string
  expiresAt: string
  store: { name: string } | null
  user: { name: string }
}
interface AdminMetrics {
  activeCustomers: number
  activeSellers: number
  ordersToday: number
  reservationsToday: number
  outOfStockSearches: number
}

function statusKind(status: string): 'stock' | 'out' | 'ready' | 'low' | 'reserved' {
  const s = status.toLowerCase()
  if (['delivered', 'completed', 'picked_up', 'confirmed', 'accepted'].includes(s)) return 'stock'
  if (['cancelled', 'canceled'].includes(s)) return 'out'
  if (['ready', 'ready_for_pickup', 'packed'].includes(s)) return 'ready'
  if (['pending', 'requested'].includes(s)) return 'low'
  return 'reserved'
}

export default function AdminOps() {
  const [orders, setOrders] = useState<AdminOrderRow[] | null>(null)
  const [reservations, setReservations] = useState<AdminReservationRow[] | null>(null)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      api.get<AdminOrderRow[]>('/admin/orders'),
      api.get<AdminReservationRow[]>('/admin/reservations'),
      api.get<AdminMetrics>('/admin/metrics'),
    ])
      .then(([o, r, m]) => {
        if (!live) return
        setOrders(o)
        setReservations(r)
        setMetrics(m)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-m-h1 lg:text-h2 font-bold">Operations</h1>
        <p className="text-body-sm text-neutral-500 mt-1">Live orders, reservations and demand from the platform database.</p>
      </div>

      {error && (
        <div className="nb-card p-4 border-warning-200 bg-warning-50 text-sm text-warning-800">
          Could not load operations data: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Orders (24h)" value={metrics?.ordersToday ?? '—'} />
        <StatCard label="Reservations (24h)" value={metrics?.reservationsToday ?? '—'} />
        <StatCard label="Active stores" value={metrics?.activeSellers ?? '—'} hint="open right now" />
        <StatCard label="Unfulfilled searches" value={metrics?.outOfStockSearches ?? '—'} hint="last 24h" accent="text-warning-700" />
      </div>

      <div className="nb-card overflow-x-auto">
        <SectionHeading title="Recent orders" className="p-5 pb-0" />
        <table className="w-full min-w-[720px] nb-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Items</th>
              <th>Store</th>
              <th>Fulfilment</th>
              <th>Total</th>
              <th>Status</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td className="font-data font-semibold">{o.number}</td>
                <td>{o.items[0]?.name ? `${o.items[0].name} ×${o.items[0].qty}` : `${o.items.length} item${o.items.length === 1 ? '' : 's'}`}</td>
                <td>{o.store?.name ?? '—'}</td>
                <td className="capitalize">{(o.fulfillmentMethod ?? '').replace('_', ' ')}</td>
                <td className="font-data">{formatINR(Number(o.total))}</td>
                <td>
                  <StatusBadge kind={statusKind(o.status)}>
                    {o.status.replace(/_/g, ' ')}
                  </StatusBadge>
                </td>
                <td className="text-caption">{dayTime(new Date(o.createdAt).getTime())}</td>
              </tr>
            ))}
            {!orders && !error && (
              <tr>
                <td colSpan={7} className="text-center text-neutral-400 py-6">Loading orders…</td>
              </tr>
            )}
            {orders?.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-neutral-400 py-6">No orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="nb-card overflow-x-auto">
        <SectionHeading title="Reservations" className="p-5 pb-0" />
        <table className="w-full min-w-[640px] nb-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Store</th>
              <th>Window</th>
              <th>Status</th>
              <th>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {(reservations ?? []).map((r) => (
              <tr key={r.id}>
                <td className="font-data font-bold text-[#6D28D9]">{r.code}</td>
                <td>{r.store?.name ?? '—'}</td>
                <td>{r.pickupWindow}</td>
                <td>
                  <StatusBadge kind={statusKind(r.status)}>
                    {r.status.replace(/_/g, ' ')}
                  </StatusBadge>
                </td>
                <td className="text-caption">{dayTime(new Date(r.expiresAt).getTime())}</td>
              </tr>
            ))}
            {!reservations && !error && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-400 py-6">Loading reservations…</td>
              </tr>
            )}
            {reservations?.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-400 py-6">No reservations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
