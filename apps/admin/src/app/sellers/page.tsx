'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSellers, useAdminAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, Badge, s, SectionHeader } from '@nearbuy/ui'

export default function AdminSellers() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading, refetch } = useAdminSellers()
  const act = useAdminAction()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('admin.sellers', 'Sellers & KYC')} action={<p className="text-xs text-ink-muted">{s('admin.trustNote', 'Fraud scoring is internal — no public seller trust score.')}</p>} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((sl) => (
          <li key={sl.id}>
            <Card className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink">{sl.businessName}</p>
                <Badge tone={sl.status === 'APPROVED' ? 'success' : 'warning'}>{sl.status}</Badge>
              </div>
              <p className="mt-1 text-ink-secondary">{sl.user?.name ?? '—'} · {sl.stores} {s('admin.stores', 'Stores')}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" loading={act.isPending}
                  onClick={() => act.mutate({ path: `/admin/sellers/${sl.id}/verify`, body: { action: 'APPROVE' } }, { onSuccess: () => void refetch() })}>
                  {s('admin.approve', 'Approve')}
                </Button>
                <Button size="sm" variant="destructive" loading={act.isPending}
                  onClick={() => act.mutate({ path: `/admin/sellers/${sl.id}/verify`, body: { action: 'REJECT' } }, { onSuccess: () => void refetch() })}>
                  {s('admin.reject', 'Reject')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
