import { apiServer } from '@/lib/server-api'
import { notFound } from 'next/navigation'
import type { OrderDetail } from '@nearbuy/api'
import { s, formatINR } from '@nearbuy/ui'
import { PrintButton } from '@/components/print-button'

export const dynamic = 'force-dynamic'

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const order = await apiServer<OrderDetail>(`/orders/${params.id}`)
  if (!order) notFound()
  return (
    <div className="nb-container max-w-3xl py-8">
      <div className="rounded-card border border-border bg-white p-8 print:border-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-primary-600">NEARBUY</p>
            <p className="text-xs text-ink-muted">{s('brand.tagline', 'What You Need, Already Nearby.')}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">{s('order.invoice', 'Invoice')}</p>
            <p className="font-mono">{order.number}</p>
            <p>{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th className="py-2">{s('order.items', 'Items')}</th>
              <th className="py-2 text-right">{s('product.qty', 'Qty')}</th>
              <th className="py-2 text-right">{s('order.amount', 'Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((i) => (
              <tr key={i.id} className="border-b border-canvas">
                <td className="py-2">{i.name}</td>
                <td className="py-2 text-right">{i.qty}</td>
                <td className="py-2 text-right">{formatINR(Number(i.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span>{s('cart.subtotal', 'Subtotal')}</span><span>{formatINR(Number(order.subtotal))}</span></div>
          <div className="flex justify-between"><span>{s('checkout.fee', 'Delivery fee')}</span><span>{formatINR(Number(order.deliveryFee))}</span></div>
          <div className="flex justify-between text-success-600"><span>{s('checkout.discount', 'Discount')}</span><span>−{formatINR(Number(order.discount))}</span></div>
          <div className="flex justify-between text-base font-extrabold"><span>{s('cart.total', 'Total')}</span><span>{formatINR(Number(order.total))}</span></div>
        </div>
        <p className="mt-8 text-center text-xs text-ink-muted">{s('invoice.taxNote', 'NearBuy Marketplace · Local commerce, connected.')}</p>
        <PrintButton label={s('invoice.print', 'Print / Save PDF')} />
      </div>
    </div>
  )
}
