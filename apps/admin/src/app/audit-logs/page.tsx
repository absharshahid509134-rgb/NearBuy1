'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuditLogs, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, LoadingBlock, s, SectionHeader } from '@nearbuy/ui'

export default function AuditLogs() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading } = useAuditLogs()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('admin.auditLogs', 'Audit logs')} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3">{s('admin.time', 'Time')}</th>
              <th className="p-3">{s('admin.action', 'Action')}</th>
              <th className="p-3">{s('admin.entity', 'Entity')}</th>
              <th className="p-3">{s('admin.actor', 'Actor')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="border-b border-canvas">
                <td className="p-3 text-xs text-ink-muted">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="p-3 font-mono text-xs font-bold">{a.action}</td>
                <td className="p-3">{a.entity} {a.entityId ? `· ${a.entityId.slice(-6)}` : ''}</td>
                <td className="p-3 font-mono text-xs">{a.actorId?.slice(-6) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
