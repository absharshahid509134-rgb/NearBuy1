'use client'
import * as React from 'react'
import Link from 'next/link'
import { useReturns, useReturnAction, useSession } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, ErrorBlock, StatusBadge, OrderStatusTimeline, s, formatINR, SectionHeader, Badge } from '@nearbuy/ui'

const ACTIONS: Record<string, string[]> = {
  REQUESTED: ['Approve', 'Reject'],
  APPROVED: ['Schedule'],
  PICKUP_SCHEDULED: ['Pickup'],
  PICKED_UP: ['Receive'],
  RECEIVED: ['Inspect'],
  INSPECTION: ['Refund', 'Replace', 'Reject'],
  REFUND_INITIATED: [],
  REFUNDED: [],
  REJECTED: [],
  REPLACED: [],
}

export default function ReturnsPage() {
  const { user, checked } = useSession()
  const { data, isLoading, error, refetch } = useReturns()
  const action = useReturnAction()

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>
  if (isLoading) return <LoadingBlock />
  if (error) return <div className="nb-container py-10"><ErrorBlock message={error.message} retry={() => void refetch()} /></div>

  const rows = data ?? []

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('return.title', 'Return or replace')} />
      {rows.length === 0 ? (
        <EmptyState title={s('return.empty', 'No returns')} hint={s('return.emptyHint', 'Start a return from any delivered order — eligibility is checked automatically.')} action={<Link href="/orders"><Button>{s('nav.orders', 'Orders')}</Button></Link>} />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-sm font-bold text-primary-600">{r.number}</p>
                  <Badge tone="neutral">{r.orderNumber}</Badge>
                  <Badge tone="accent">{r.resolution}</Badge>
                  <StatusBadge status={r.status} />
                  <p className="ml-auto text-sm font-bold">{formatINR(Number(r.refund?.amount ?? 0))}</p>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-ink-secondary">
                  {r.items.map((i) => (
                    <li key={i.id}>{i.name} × {i.qty} — {i.reason.replaceAll('_', ' ')}</li>
                  ))}
                </ul>
                {r.refund && <p className="mt-2 text-xs font-semibold text-ink-muted">↩ {s('return.refund', 'Refund')}: {r.refund.status}</p>}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <OrderStatusTimeline status={r.status} kind="reservation" />
                  <div className="flex flex-wrap content-start gap-2">
                    {(ACTIONS[r.status] ?? []).map((a) => (
                      <Button key={a} size="sm" variant={a === 'Reject' ? 'destructive' : a === 'Refund' || a === 'Replace' ? 'accent' : 'primary'}
                        loading={action.isPending} onClick={() => action.mutate({ id: r.id, action: a })}>
                        {a}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

