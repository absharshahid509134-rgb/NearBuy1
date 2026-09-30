'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useReturns, useReturnAction, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, StatusBadge, Badge, s, formatINR, SectionHeader } from '@nearbuy/ui'

const ACTIONS: Record<string, string[]> = {
  REQUESTED: ['Approve', 'Reject'],
  APPROVED: ['Schedule'],
  PICKUP_SCHEDULED: ['Pickup'],
  PICKED_UP: ['Receive'],
  RECEIVED: ['Inspect'],
  INSPECTION: ['Refund', 'Replace', 'Reject'],
}

export default function SellerReturns() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, refetch, isLoading } = useReturns('seller')
  const action = useReturnAction()

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('seller.returns', 'Returns & inspections')} />
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <li key={r.id}>
            <Card className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-primary-600">{r.number}</span>
                <Badge tone="neutral">{r.orderNumber}</Badge>
                <Badge tone="accent">{r.resolution}</Badge>
                <StatusBadge status={r.status} />
                <span className="ml-auto font-bold">{formatINR(Number(r.refund?.amount ?? 0))}</span>
              </div>
              <ul className="mt-2 text-ink-secondary">
                {r.items.map((i) => <li key={i.id}>{i.name} × {i.qty} — {i.reason.replaceAll('_', ' ')}</li>)}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1">
                {(ACTIONS[r.status] ?? []).map((a) => (
                  <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : a === 'Refund' || a === 'Replace' ? 'accent' : 'primary'}
                    loading={action.isPending} onClick={() => action.mutate({ id: r.id, action: a }, { onSuccess: () => void refetch() })}>
                    {a}
                  </Button>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
