import { useEffect, useState } from 'react'
import { api } from '../../auth/api'
import { NearbyMap } from '../../components/commerce'
import { SectionHeading, StatCard, StatusBadge } from '../../components/ui'
import { useCatalog } from '../../store/CatalogContext'

interface AdminMetrics {
  city: string
  activeCustomers: number
  activeSellers: number
  ordersToday: number
  reservationsToday: number
  outOfStockSearches: number
  fulfillmentMix: { method: string; count: number }[]
}

const MIX_COLORS: Record<string, string> = {
  LOCAL_DELIVERY: 'bg-sky-500',
  NEARBY_PICKUP: 'bg-primary-500',
  STANDARD_DELIVERY: 'bg-success-500',
  FAST_DELIVERY: 'bg-fast',
}

export default function AdminOverview() {
  const { stores, status } = useCatalog()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<AdminMetrics>('/admin/metrics')
      .then((m) => {
        if (live) setMetrics(m)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])

  const total = metrics?.fulfillmentMix.reduce((s, f) => s + f.count, 0) ?? 0
  const openCount = stores.filter((s) => s.open).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-m-h1 lg:text-h2 font-bold">City Command Center — {metrics?.city ?? 'Delhi'}</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          Marketplace health computed from the live database — no demo figures.
        </p>
      </div>

      {error && (
        <div className="nb-card p-4 border-warning-200 bg-warning-50 text-sm text-warning-800">
          Metrics unavailable: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Customers" value={metrics ? metrics.activeCustomers : '—'} hint="ordered in last 24h" />
        <StatCard label="Active Stores" value={status === 'ready' ? stores.length : '—'} hint={`${openCount} open right now`} />
        <StatCard label="Orders Today" value={metrics ? metrics.ordersToday : '—'} hint="last 24h" />
        <StatCard label="Reservations" value={metrics ? metrics.reservationsToday : '—'} hint="last 24h" accent="text-[#6D28D9]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Unfulfilled searches" value={metrics ? metrics.outOfStockSearches : '—'} hint="demand leaking — see Radar" accent="text-warning-700" />
      </div>

      {/* map layer */}
      <div className="nb-card p-6">
        <SectionHeading title="Map layer" sub="Persisted stores on the map" />
        <div className="grid lg:grid-cols-[1fr,240px] gap-5">
          <NearbyMap stores={stores.slice(0, 7)} height={340} route />
          <div className="space-y-2">
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3.5">
              <p className="text-caption text-neutral-500">🏪 Stores</p>
              <p className="text-body-sm font-semibold">{status === 'ready' ? `${openCount} open · ${stores.length - openCount} closed` : '…'}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3.5">
              <p className="text-caption text-neutral-500">📦 Orders active</p>
              <p className="text-body-sm font-semibold">{metrics ? metrics.ordersToday : '—'}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3.5">
              <p className="text-caption text-neutral-500">📥 Reservations</p>
              <p className="text-body-sm font-semibold">{metrics ? metrics.reservationsToday : '—'}</p>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-200 p-3.5">
              <p className="text-caption font-semibold text-sky-600">Unfulfilled demand</p>
              <p className="text-caption text-neutral-600 mt-1">
                Searches with no local stock — see the Demand Radar for sourcing gaps.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* fulfilment mix */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="nb-card p-6">
          <SectionHeading title="Today's fulfilment mix" sub="Share of orders by method (last 24h)" />
          {total === 0 ? (
            <p className="text-body-sm text-neutral-400">No orders in the last 24 hours yet.</p>
          ) : (
            (metrics?.fulfillmentMix ?? []).map((f) => {
              const pct = Math.round((f.count / total) * 100)
              return (
                <div key={f.method} className="mb-3">
                  <div className="flex justify-between text-body-sm mb-1">
                    <span className="capitalize">{f.method.replace(/_/g, ' ')}</span>
                    <span className="font-data font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${MIX_COLORS[f.method] ?? 'bg-neutral-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="nb-card p-6">
          <SectionHeading title="System" sub="What this build enforces" />
          <div className="space-y-2">
            {[
              ['Auth', 'bcrypt + httpOnly session cookies, CSRF double-submit, rate limiting'],
              ['Authorisation', 'server-side role checks on every route — full isolation between buyers, sellers & riders'],
              ['Pricing', 'all prices, fees and stock computed server-side; the client never trusts its own numbers'],
              ['Availability', 'reservations & stock-checks answered only from persisted inventory'],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-200 p-3.5">
                <StatusBadge kind="stock">✓</StatusBadge>
                <div>
                  <p className="text-body-sm font-semibold">{k as string}</p>
                  <p className="text-caption text-neutral-500">{v as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
