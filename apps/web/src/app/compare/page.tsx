'use client'
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useSearch, useNearAI } from '@nearbuy/api'
import { Card, Button, LoadingBlock, PriceBlock, Stars, s, SectionHeader, Badge, formatINR } from '@nearbuy/ui'

export default function ComparePage() {
  const sp = useSearchParams()
  const slugs = (sp.get('ids') ?? '').split(',').filter(Boolean)
  const { data, isLoading } = useSearch({ q: slugs[0] ?? 'bat', take: 8 })
  const ai = useNearAI()
  const [verdict, setVerdict] = React.useState<string>('')

  const items = (data?.hits ?? []).filter((h) => slugs.length === 0 || slugs.includes(h.slug)).slice(0, 3)

  async function askAi() {
    const names = items.map((i) => i.name).join(' vs ')
    const r = await ai.mutateAsync({ message: `Compare ${names}: which should I buy from a nearby store?` })
    setVerdict(r.reply)
  }

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('compare.title', 'Compare products')} action={<Button size="sm" variant="accent" loading={ai.isPending} onClick={() => void askAi()}>✨ {s('compare.askAi', 'Ask NearAI')}</Button>} />
      {isLoading ? <LoadingBlock /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((h) => (
            <Card key={h.productId} className="p-5">
              <p aria-hidden className="text-5xl">{h.emoji}</p>
              <p className="mt-2 font-bold text-ink">{h.name}</p>
              <p className="text-sm text-ink-secondary">{h.brand}</p>
              <div className="mt-2"><PriceBlock price={h.price} mrp={h.mrp} /></div>
              <div className="mt-1"><Stars rating={h.rating} /></div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">{s('compare.nearby', 'Nearby')}</dt><dd className="font-semibold">{h.storesNearby} {s('foundNearby.stores', 'stores')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{s('compare.units', 'Units')}</dt><dd className="font-semibold">{h.unitsNearby}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{s('foundNearby.fastest', 'Fastest')}</dt><dd className="font-semibold">{h.fastestMins ?? '—'} min</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{s('compare.price', 'Price')}</dt><dd className="font-semibold">{formatINR(h.price)}</dd></div>
              </dl>
              {h.pickupToday && <Badge tone="reserve" className="mt-2">⚡ {s('status.pickupToday', 'Pickup today')}</Badge>}
            </Card>
          ))}
        </div>
      )}
      {verdict && (
        <Card className="mt-6 p-5">
          <p className="mb-2 text-sm font-extrabold uppercase tracking-wide">✨ {s('compare.verdict', 'NearAI verdict')}</p>
          <p className="text-sm text-ink-secondary">{verdict}</p>
        </Card>
      )}
    </div>
  )
}
