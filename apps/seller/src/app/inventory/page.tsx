'use client'
import * as React from 'react'
import { useInventory, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, LoadingBlock, StatusBadge, Badge, s, formatINR, SectionHeader, Input, Label } from '@nearbuy/ui'
import { useRouter } from 'next/navigation'

export default function InventoryPage() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading, refetch } = useInventory()

  React.useEffect(() => {
    if (checked && !user) router.push('/login')
  }, [checked, user, router])
  if (!checked || isLoading) return <LoadingBlock />

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('seller.inventory', 'Inventory')} action={<p className="text-xs text-ink-muted">{s('inventory.availableFormula', 'Available = Physical − Reserved − Blocked')}</p>} />
      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-wide">{s('inventory.bulkUpload', 'Bulk upload (CSV: sku,price,qty)')}</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            void fetch('/api/v1/inventory/bulk', {
              method: 'POST', credentials: 'include',
              headers: { 'content-type': 'application/json', 'x-csrf-token': (document.cookie.split('; ').find((c) => c.startsWith('nb_csrf=')) ?? '').split('=')[1] ?? '' },
              body: JSON.stringify({ rows: String(fd.get('csv') ?? '').split('\n').map((line) => { const [sku, price, qty] = line.split(','); return { sku, price: Number(price), quantity: Number(qty) } }) }),
            }).then(() => refetch())
          }}
        >
          <div className="flex-1"><Label htmlFor="csv">{s('inventory.csv', 'CSV rows')}</Label><Input id="csv" name="csv" placeholder="SS-CB-WIL,2624,4" /></div>
          <Button type="submit">{s('inventory.upload', 'Upload')}</Button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3">{s('inventory.product', 'Product')}</th>
              <th className="p-3">{s('product.sku', 'SKU')}</th>
              <th className="p-3 text-right">{s('inventory.price', 'Price')}</th>
              <th className="p-3 text-right">{s('inventory.physical', 'Physical')}</th>
              <th className="p-3 text-right">{s('inventory.reserved', 'Reserved')}</th>
              <th className="p-3 text-right">{s('inventory.availableUnits', 'Available')}</th>
              <th className="p-3">{s('common.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-b border-canvas">
                <td className="p-3 font-semibold text-ink">{r.productName}</td>
                <td className="p-3 font-mono text-xs">{r.sku}</td>
                <td className="p-3 text-right">{formatINR(Number(r.price))}</td>
                <td className="p-3 text-right">{r.quantity}</td>
                <td className="p-3 text-right">{r.reservedQuantity}</td>
                <td className="p-3 text-right font-bold">{r.availableQuantity}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

