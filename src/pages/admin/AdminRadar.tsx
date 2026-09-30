import { useEffect, useState } from 'react'
import { api } from '../../auth/api'
import { SectionHeading, StatusBadge, StatCard, Button } from '../../components/ui'
import { useApp } from '../../store/AppContext'
import { useCatalog } from '../../store/CatalogContext'

interface DemandRow {
  query: string
  area: string
  searches: number
  unfulfilled: number
  availability: 'low' | 'medium' | 'high'
  opportunity: string
}
interface DemandRadar {
  rows: DemandRow[]
  missingNearby: { name: string; note: string }[]
}

export default function AdminRadar() {
  const { toast } = useApp()
  const { categories } = useCatalog()
  const [data, setData] = useState<DemandRadar | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<DemandRadar>('/admin/demand-radar')
      .then((d) => {
        if (live) setData(d)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])

  const rows = data?.rows ?? []
  const maxSearches = Math.max(1, ...rows.map((r) => r.searches))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-m-h1 lg:text-h2 font-bold">Demand Radar</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          Where customers search for products that are unavailable nearby — computed from real search events.
        </p>
      </div>

      {error && (
        <div className="nb-card p-4 border-warning-200 bg-warning-50 text-sm text-warning-800">
          Demand data unavailable: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tracked searches" value={rows.reduce((s, r) => s + r.searches, 0)} hint="last 30 days" accent="text-warning-700" />
        <StatCard label="Unfulfilled" value={rows.reduce((s, r) => s + r.unfulfilled, 0)} hint="no local stock found" />
        <StatCard label="Low-availability gaps" value={rows.filter((r) => r.availability === 'low').length} accent="text-primary-600" />
        <StatCard label="Tracked areas" value={new Set(rows.map((r) => r.area)).size} hint="anonymised aggregates" />
      </div>

      <div className="nb-card p-6">
        <SectionHeading title="Area signals" sub="Aggregated & anonymised — never individual searches" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] nb-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Searches</th>
                <th>30-day volume</th>
                <th>Nearby availability</th>
                <th>Opportunity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.area + d.query}>
                  <td>
                    <span className="font-semibold text-neutral-900">{d.query}</span>
                    <span className="text-caption text-neutral-400 block">{d.area}</span>
                  </td>
                  <td className="font-data font-semibold">{d.searches}</td>
                  <td>
                    <div className="h-2 w-28 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(100, (d.searches / maxSearches) * 100)}%` }} />
                    </div>
                  </td>
                  <td>
                    <StatusBadge kind={d.availability === 'low' ? 'low' : d.availability === 'medium' ? 'reserved' : 'stock'}>
                      {d.availability}
                    </StatusBadge>
                  </td>
                  <td className="text-caption">{d.opportunity}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => toast({ kind: 'info', title: 'Recruitment lead started', body: `Stores near ${d.area} for ${d.query}.` })}
                    >
                      Recruit sellers
                    </Button>
                  </td>
                </tr>
              ))}
              {!data && !error && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-400 py-6">Loading demand signals…</td>
                </tr>
              )}
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-400 py-6">
                    No search demand recorded yet — the radar fills up as customers search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* what's missing near me */}
      <div className="nb-card p-6 bg-warning-50/40 border-warning-200">
        <SectionHeading title="🔍 What's Missing Near Me?" sub="Product gaps derived from real unfulfilled searches." />
        <div className="grid sm:grid-cols-2 gap-3">
          {(data?.missingNearby ?? []).map((m) => (
            <div key={m.name} className="bg-white rounded-xl border border-warning-200 p-4">
              <p className="text-body font-semibold">{m.name}</p>
              <p className="text-body-sm text-neutral-500 mt-1">{m.note}</p>
            </div>
          ))}
          {data && (data.missingNearby ?? []).length === 0 && (
            <p className="text-body-sm text-neutral-400">No low-availability gaps yet.</p>
          )}
        </div>
        <p className="text-caption text-neutral-400 mt-4">
          Feeds seller recruitment and merchant opportunity reports — never exposes individual searches.
        </p>
      </div>

      <div className="nb-card p-6">
        <SectionHeading title="Categories on the platform" />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="px-4 py-2 rounded-full text-body-sm font-semibold border border-neutral-200 bg-neutral-50 text-neutral-700">
              {c.emoji} {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
