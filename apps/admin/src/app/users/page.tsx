'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAdminUsers, useAdminAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, StatusBadge, Badge, s, SectionHeader } from '@nearbuy/ui'

export default function AdminUsers() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading, refetch } = useAdminUsers()
  const act = useAdminAction()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('admin.users', 'Users')} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3">{s('auth.name', 'Name')}</th>
              <th className="p-3">{s('auth.email', 'Email')}</th>
              <th className="p-3">{s('common.role', 'Role')}</th>
              <th className="p-3">{s('common.status', 'Status')}</th>
              <th className="p-3">{s('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-b border-canvas">
                <td className="p-3 font-semibold text-ink">{u.name}</td>
                <td className="p-3">{u.email ?? u.phone ?? '—'}</td>
                <td className="p-3"><Badge tone="info">{u.role.replaceAll('_', ' ')}</Badge></td>
                <td className="p-3"><StatusBadge status={u.status} /></td>
                <td className="p-3">
                  <Button size="sm" variant="outline" loading={act.isPending}
                    onClick={() => act.mutate({ path: `/admin/users/${u.id}/status`, body: { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } }, { onSuccess: () => void refetch() })}>
                    {u.status === 'ACTIVE' ? s('admin.suspend', 'Suspend') : s('admin.activate', 'Activate')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
