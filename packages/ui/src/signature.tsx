/**
 * NearBuy signature components.
 * NearBuyAvailabilityCard — "HOW DO YOU WANT TO GET IT?" rendered strictly from
 * the fulfillment engine's data (never hard-coded availability in the UI).
 */
'use client'
import * as React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { cn, formatINR } from './index'
import { s } from './strings'
import { Badge, Card } from './primitives'
import { StatusBadge } from './commerce'
type FulfillmentOption = import('@nearbuy/types').FulfillmentOption
const METHOD_ICON: Record<string, string> = {
  STANDARD: '🚚', FAST: '⚡', PICKUP: '🏪', LOCAL_DELIVERY: '🛵', RESERVE_AND_PICKUP: '📍',
}

export function NearBuyAvailabilityCard({
  options, selected, onSelect, loading,
}: {
  options: FulfillmentOption[]
  selected?: string
  onSelect?: (opt: FulfillmentOption) => void
  loading?: boolean
}) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink">
        {s('product.getItTitle', 'How do you want to get it?')}
      </h2>
      {loading && <p className="py-4 text-sm text-ink-muted">{s('common.loading', 'Loading…')}</p>}
      {!loading && options.length === 0 && (
        <p className="py-4 text-sm text-ink-muted">{s('product.noOptions', 'No fulfillment options for this product right now.')}</p>
      )}
      <ul className="flex flex-col gap-2" role="radiogroup" aria-label={s('product.getItTitle', 'How do you want to get it?')}>
        {options.map((opt) => {
          const disabled = !opt.available || !onSelect
          const active = selected === opt.method
          return (
            <li key={opt.method}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onSelect?.(opt)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors',
                  active ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-border bg-card hover:border-primary-300',
                  disabled && 'opacity-55',
                )}
              >
                <span aria-hidden className="text-2xl">{METHOD_ICON[opt.method] ?? '📦'}</span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-ink">{opt.label}</span>
                  <span className="block text-xs text-ink-muted">{opt.estimatedTime}</span>
                  {!opt.available && opt.reason && (
                    <span className="mt-0.5 block text-xs font-semibold text-error-500">{opt.reason}</span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold text-ink">{opt.fee > 0 ? formatINR(opt.fee) : s('product.free', 'FREE')}</span>
                  {opt.available && opt.storeId && <Badge tone="reserve">{s('status.local', 'Local')}</Badge>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}


const STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']
const RES_STEPS = ['REQUESTED', 'CONFIRMED', 'PACKING', 'READY_FOR_PICKUP', 'CUSTOMER_ARRIVED', 'COLLECTED', 'COMPLETED']

export function OrderStatusTimeline({ status, kind = 'order' }: { status: string; kind?: 'order' | 'reservation' }) {
  const steps = kind === 'reservation' ? RES_STEPS : STEPS
  const idx = steps.indexOf(status)
  const done = idx >= 0 ? idx : steps.length - 1
  const failed = ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW', 'FAILED'].includes(status)
  return (
    <ol className="flex flex-col gap-0" aria-label={s('order.progress', 'Order progress')}>
      {steps.map((step, i) => {
        const state = failed && i === done ? 'error' : i < done ? 'done' : i === done ? 'current' : 'todo'
        return (
          <li key={step} className="flex gap-3" aria-current={state === 'current' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  state === 'done' && 'bg-success-500 text-white',
                  state === 'current' && 'bg-primary-600 text-white ring-4 ring-primary-100',
                  state === 'error' && 'bg-error-500 text-white',
                  state === 'todo' && 'bg-neutral-100 text-ink-muted',
                )}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              {i < steps.length - 1 && <span className={cn('h-8 w-0.5', i < done ? 'bg-success-500' : 'bg-neutral-100')} />}
            </div>
            <div className="pb-2 pt-1">
              <p className={cn('text-sm font-semibold', state === 'todo' ? 'text-ink-muted' : 'text-ink')}>{step.replaceAll('_', ' ')}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ReservationTicket({ reservation }: {
  reservation: { code: string; status: string; qr: string; pickupWindow: string; store: { name: string; area: string; address: string; phone: string } }
}) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-primary-600 px-4 py-3 text-white">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{s('reserve.pickupCode', 'Pickup Code')}</p>
        <p className="text-2xl font-extrabold tracking-widest">{reservation.code}</p>
      </div>
      <div className="flex flex-col items-center gap-3 p-4">
        <div className="rounded-card border border-border bg-white p-3">
          <QRCodeSVG value={reservation.qr} size={148} />
        </div>
        <p className="text-center text-xs text-ink-muted">{s('reserve.showQr', 'Show this QR code at the store')}</p>
        <StatusBadge status={reservation.status} />
        <div className="w-full rounded-card bg-canvas p-3 text-sm">
          <p className="font-bold text-ink">{reservation.store.name}</p>
          <p className="text-ink-secondary">{reservation.store.area} · {reservation.store.address}</p>
          <p className="mt-1 font-semibold text-primary-600">{s('reserve.window', 'Pickup window')}: {reservation.pickupWindow}</p>
          <p className="text-ink-muted">☎ {reservation.store.phone}</p>
        </div>
      </div>
    </Card>
  )
}



