'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useProducts, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, Badge, s, SectionHeader } from '@nearbuy/ui'

export default function SellerProducts() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading } = useProducts(48)

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader
        title={s('seller.products', 'Products')}
        action={<Button size="sm">{s('seller.addProduct', 'Add product (AI listing)')}</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((p) => (
          <Card key={p.id} className="flex items-center gap-3 p-4">
            <span className="text-3xl">{p.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink">{p.name}</p>
              <p className="font-mono text-xs text-ink-muted">{p.sku}</p>
            </div>
            <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? s('status.active', 'Active') : s('status.inactive', 'Inactive')}</Badge>
          </Card>
        ))}
      </div>
    </div>
  )
}
