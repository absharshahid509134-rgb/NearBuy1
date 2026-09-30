'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useDemandRadar, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, LoadingBlock, Badge, s, SectionHeader } from '@nearbuy/ui'

export default function DemandRadar() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading } = useDemandRadar()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('admin.demandRadar', 'Demand Radar')} action={<p className="text-xs text-ink-muted">{s('admin.demandNote', 'Unmet local demand signals')}</p>} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3">{s('search.query', 'Query')}</th>
              <th className="p-3">{s('address.area', 'Area')}</th>
              <th className="p-3 text-right">{s('admin.count', 'Count')}</th>
              <th className="p-3">{s('admin.intent', 'Intent')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((d) => (
              <tr key={d.id} className="border-b border-canvas">
                <td className="p-3 font-semibold text-ink">{d.query}</td>
                <td className="p-3">{d.area}</td>
                <td className="p-3 text-right font-bold">{d.count}</td>
                <td className="p-3">{d.intent && <Badge tone="info">{d.intent}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
