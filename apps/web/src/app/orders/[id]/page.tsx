'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOrder, useCancelOrder, useCreateReturn } from '@nearbuy/api'
import { Card, Button, LoadingBlock, ErrorBlock, StatusBadge, OrderStatusTimeline, s, formatINR, SectionHeader, Badge, Select } from '@nearbuy/ui'

const RETURN_REASONS = ['DAMAGED', 'WRONG_ITEM', 'MISSING_ITEMS', 'DEFECTIVE', 'SIZE_ISSUE', 'MIND_CHANGE'] as const

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: order, isLoading, error, refetch } = useOrder(params.id)
  const cancel = useCancelOrder()
  const ret = useCreateReturn()
  const [reasons, setReasons] = React.useState<Record<string, string>>({})
  const [resolution, setResolution] = React.useState<'REFUND' | 'REPLACEMENT'>('REFUND')
  const [retErr, setRetErr] = React.useState<string | undefined>()

  if (isLoading) return <LoadingBlock />
  if (error || !order) return <div className="nb-container py-10"><ErrorBlock message={error?.message ?? s('common.error', 'Something went wrong.')} retry={() => void refetch()} /></div>

  async function onRequestReturn() {
    setRetErr(undefined)
    try {
      const items = (order?.items ?? [])
        .filter((i) => reasons[i.productId])
        .map((i) => ({ productId: i.productId, qty: i.qty, reason: reasons[i.productId] }))
      if (items.length === 0) {
        setRetErr(s('return.pickItem', 'Pick a reason for at least one item.'))
        return
      }
      await ret.mutateAsync({ orderId: order?.id ?? '', items, resolution })
      router.push('/orders?return=requested')
    } catch (e) {
      setRetErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-[1fr,360px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">{order.number}</h1>
          <StatusBadge status={order.status} />
          <Badge tone="neutral">{order.fulfillmentMethod.replaceAll('_', ' ')}</Badge>
        </div>

        <Card className="p-5">
          <SectionHeader title={s('order.progress', 'Order progress')} />
          <OrderStatusTimeline status={order.status} />
          <ul className="mt-4 space-y-1">
            {order.events?.map((ev) => (
              <li key={ev.id} className="flex justify-between text-xs text-ink-muted">
                <span>{ev.status}{ev.note ? ` — ${ev.note}` : ''}</span>
                <span>{new Date(ev.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4 p-5">
          <SectionHeader title={s('order.items', 'Items')} />
          <ul className="space-y-3">
            {order.items?.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3">
                <span className="text-3xl">{i.emoji}</span>
                <span className="flex-1 font-semibold text-ink">{i.name} × {i.qty}</span>
                <span className="font-bold">{formatINR(Number(i.lineTotal))}</span>
                {['DELIVERED', 'COMPLETED'].includes(order.status) && (
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={s('return.reason', 'Return reason')}
                      value={reasons[i.productId] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [i.productId]: e.target.value }))}
                      className="h-9 text-xs"
                    >
                      <option value="">{s('return.selectReason', 'Return reason…')}</option>
                      {RETURN_REASONS.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
                    </Select>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {['DELIVERED', 'COMPLETED'].includes(order.status) && (
            <div className="mt-4 rounded-card bg-canvas p-4">
              <p className="mb-2 text-sm font-extrabold uppercase tracking-wide">{s('return.title', 'Return or replace')}</p>
              <div className="mb-3 flex gap-3">
                {(['REFUND', 'REPLACEMENT'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm font-bold">
                    <input type="radio" checked={resolution === r} onChange={() => setResolution(r)} className="accent-primary-600" /> {r}
                  </label>
                ))}
              </div>
              {retErr && <p role="alert" className="mb-2 text-xs font-semibold text-error-500">{retErr}</p>}
              <Button variant="accent" loading={ret.isPending} onClick={() => void onRequestReturn()}>
                {s('return.cta', 'Request return')}
              </Button>
              <p className="mt-2 text-xs text-ink-muted">{s('return.flow', 'Eligibility → pickup → inspection → refund/replacement. Statuses are tracked end-to-end.')}</p>
            </div>
          )}
        </Card>

        {order.canCancel && ['PLACED', 'CONFIRMED'].includes(order.status) && (
          <Button variant="destructive" className="mt-4" loading={cancel.isPending} onClick={() => cancel.mutate(order.id)}>
            {s('order.cancel', 'Cancel order')}
          </Button>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <Card className="p-5">
          <SectionHeader title={s('order.summary', 'Summary')} />
          <div className="flex justify-between text-sm"><span>{s('cart.subtotal', 'Subtotal')}</span><span>{formatINR(Number(order.subtotal))}</span></div>
          <div className="flex justify-between text-sm"><span>{s('checkout.fee', 'Delivery fee')}</span><span>{formatINR(Number(order.deliveryFee))}</span></div>
          <div className="flex justify-between text-sm text-success-600"><span>{s('checkout.discount', 'Discount')}</span><span>−{formatINR(Number(order.discount))}</span></div>
          <hr className="my-2 border-border" />
          <div className="flex justify-between text-base font-extrabold"><span>{s('cart.total', 'Total')}</span><span>{formatINR(Number(order.total))}</span></div>
          {order.payment && <p className="mt-2 text-xs text-ink-muted">{order.payment.method} · {order.payment.status}</p>}
          <Link href={`/orders/${order.id}/invoice`} className="mt-3 inline-block text-sm font-bold text-primary-600">{s('order.invoice', 'View invoice')} →</Link>
        </Card>
        {order.addressSnap && (
          <Card className="p-5">
            <SectionHeader title={s('order.shipping', 'Shipping address')} />
            <p className="text-sm text-ink-secondary">
              {Object.values(order.addressSnap).filter(Boolean).join(', ')}
            </p>
          </Card>
        )}
        <Card className="p-5">
          <SectionHeader title={s('order.help', 'Need help?')} />
          <Link href="/help" className="text-sm font-bold text-primary-600">{s('nav.help', 'Help')} →</Link>
        </Card>
      </aside>
    </div>
  )
}

