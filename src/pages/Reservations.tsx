import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ReservationCard } from '../components/commerce'
import { EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import type { ReservationStatus } from '../data/types'

const FILTERS: { id: ReservationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: '🟠 Awaiting Confirmation' },
  { id: 'confirmed', label: '🟢 Confirmed' },
  { id: 'ready', label: '📦 Ready for Pickup' },
  { id: 'collected', label: '✅ Collected' },
  { id: 'expired', label: '⌛ Expired' },
  { id: 'cancelled', label: '❌ Cancelled' },
]

export default function Reservations() {
  const navigate = useNavigate()
  const { reservations, refreshCommerce, commerceError } = useApp()
  const [filter, setFilter] = useState<ReservationStatus | 'all'>('all')
  useEffect(() => { void refreshCommerce() }, [refreshCommerce])

  const list = reservations.filter((r) => filter === 'all' || r.status === filter)

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-m-h1 lg:text-h1">Reservations</h1><p className="text-body-sm text-neutral-500 mt-1">Booked at nearby stores — each with a QR code, pickup code and expiry time.</p></div>
        <button type="button" onClick={() => void refreshCommerce()} className="hub-secondary-button"><RefreshCw size={16} /> Refresh status</button>
      </div>
      {commerceError && <div role="alert" className="rounded-lg border border-error-200 bg-error-50 text-error-700 p-3 text-body-sm">{commerceError}</div>}

      <div className="flex gap-2 nb-scroll-x pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch transition-colors duration-fast ${
              filter === f.id
                ? 'bg-reserve text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="space-y-4 max-w-2xl">
          {list.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔖"
          title="No reservations here"
          body="Reserve & Pickup keeps an item aside at the store — you'll get a QR code to collect it."
          action="Find something to reserve"
          onAction={() => navigate('/nearby-now')}
        />
      )}
    </div>
  )
}
