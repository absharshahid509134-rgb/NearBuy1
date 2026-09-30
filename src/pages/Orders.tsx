import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OrderCard, ReservationCard } from '../components/commerce'
import { EmptyState, Tabs } from '../components/ui'
import { useApp } from '../store/AppContext'
import type { Order, Reservation } from '../data/types'

type Tab = 'active' | 'delivered' | 'pickup' | 'reservations' | 'cancelled' | 'returns'

export default function Orders() {
  const navigate = useNavigate()
  const { orders, reservations, refreshCommerce, commerceError } = useApp()
  const [tab, setTab] = useState<Tab>('active')
  useEffect(() => { void refreshCommerce() }, [refreshCommerce])

  const active = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status),
  )
  const delivered = orders.filter((o) => ['delivered', 'picked_up'].includes(o.status) && o.fulfillment !== 'pickup')
  const pickup = orders.filter((o) => o.fulfillment === 'pickup' && o.status !== 'cancelled')
  const cancelled = orders.filter((o) => o.status === 'cancelled')
  const returns = orders.filter((o) => o.status === 'returned')

  const list: (Order | Reservation)[] =
    tab === 'active'
      ? active
      : tab === 'delivered'
        ? delivered
        : tab === 'pickup'
          ? pickup
          : tab === 'cancelled'
            ? cancelled
            : tab === 'returns'
              ? returns
              : []

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-m-h1 lg:text-h1">Orders</h1><p className="text-body-sm text-neutral-500 mt-1">Everything you've bought — tracked end to end.</p></div>
        <button type="button" onClick={() => void refreshCommerce()} className="hub-secondary-button"><RefreshCw size={16} /> Refresh status</button>
      </div>
      {commerceError && <div role="alert" className="rounded-lg border border-error-200 bg-error-50 text-error-700 p-3 text-body-sm">{commerceError}</div>}

      <Tabs<Tab>
        tabs={[
          { id: 'active', label: 'Active', count: active.length || undefined },
          { id: 'delivered', label: 'Delivered', count: delivered.length || undefined },
          { id: 'pickup', label: 'Pickup', count: pickup.length || undefined },
          { id: 'reservations', label: 'Reservations', count: reservations.length || undefined },
          { id: 'cancelled', label: 'Cancelled', count: cancelled.length || undefined },
          { id: 'returns', label: 'Returns', count: returns.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'reservations' ? (
        <div className="space-y-4">
          {reservations.length ? (
            reservations.map((r) => <ReservationCard key={r.id} reservation={r} />)
          ) : (
            <EmptyState
              icon="🔖"
              title="No reservations"
              body="Reserve items at nearby stores and collect them with a QR pickup code."
              action="Find Nearby"
              onAction={() => navigate('/nearby')}
            />
          )}
        </div>
      ) : list.length ? (
        <div className="space-y-4">
          {list.map((o) => <OrderCard key={o.id} order={o as Order} />)}
        </div>
      ) : (
        <EmptyState
          icon="📦"
          title="Nothing here yet"
          body="Orders you place will show up here with live status."
          action="Start shopping"
          onAction={() => navigate('/customer')}
        />
      )}
    </div>
  )
}
