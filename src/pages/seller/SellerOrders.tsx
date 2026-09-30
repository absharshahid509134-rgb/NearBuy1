import { useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronRight, Package, QrCode, RefreshCw } from 'lucide-react'
import { useSeller, type SellerOrder, type SellerReservation } from '../../seller/SellerContext'
import { HubEmpty, HubError, HubLoading, rupees, StatusPill, when } from '../../seller/components'

function nextOrderAction(order: SellerOrder): { action: string; label: string } | null {
  if (order.status === 'READY_FOR_PICKUP' && order.delivery)
    return null // The rider, not the seller, confirms a delivery at the customer's door.
  const actions: Record<string, { action: string; label: string }> = {
    PENDING: { action: 'accept', label: 'Accept order' },
    CONFIRMED: { action: 'preparing', label: 'Start preparing' },
    PREPARING: { action: 'packed', label: 'Mark packed' },
    PACKED: { action: 'ready', label: 'Ready for pickup' },
    READY_FOR_PICKUP: { action: 'complete', label: 'Complete order' },
  }
  return actions[order.status] ?? null
}
function nextReservationAction(reservation: SellerReservation): { action: string; label: string } | null {
  const actions: Record<string, { action: string; label: string }> = {
    REQUESTED: { action: 'confirm', label: 'Confirm reservation' },
    CONFIRMED: { action: 'pack', label: 'Mark packed' },
    PACKING: { action: 'ready', label: 'Ready for pickup' },
    READY_FOR_PICKUP: { action: 'arrive', label: 'Customer arrived' },
    CUSTOMER_ARRIVED: { action: 'collect', label: 'Handed to customer' },
    COLLECTED: { action: 'complete', label: 'Complete reservation' },
  }
  return actions[reservation.status] ?? null
}

export default function SellerOrders() {
  const { orders, reservations, loading, error, refresh, orderAction, reservationAction } = useSeller()
  const [tab, setTab] = useState<'orders' | 'reservations'>('orders')
  const [working, setWorking] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  async function run(id: string, action: string, kind: 'order' | 'reservation') {
    setWorking(id)
    setActionError('')
    try {
      if (kind === 'order') await orderAction(id, action)
      else await reservationAction(id, action)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this item. Try again.')
    } finally {
      setWorking(null)
    }
  }
  if (loading && !orders.length && !reservations.length) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">SELLER HUB / FULFILMENT</p>
          <h1>Orders & reservations</h1>
          <p>Everything your neighbours are waiting for, all in one place.</p>
        </div>
        <button type="button" className="hub-secondary-button" disabled={loading} onClick={() => void refresh()} aria-label="Refresh orders and reservations">
          <RefreshCw size={16} /> {loading ? 'Refreshing…' : 'Refresh orders'}
        </button>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Order type">
        <button
          role="tab"
          aria-selected={tab === 'orders'}
          className={tab === 'orders' ? 'selected' : ''}
          onClick={() => setTab('orders')}
        >
          <Package size={17} /> Orders <span>{orders.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'reservations'}
          className={tab === 'reservations' ? 'selected' : ''}
          onClick={() => setTab('reservations')}
        >
          <QrCode size={17} /> Reservations <span>{reservations.length}</span>
        </button>
      </div>
      {actionError && (
        <div className="hub-inline-error" role="alert">
          {actionError}
        </div>
      )}
      {tab === 'orders' ? (
        orders.length ? (
          <div className="hub-records">
            {orders.map((order) => {
              const next = nextOrderAction(order)
              return (
                <article className="hub-record" key={order.id}>
                  <div className="hub-record-top">
                    <div>
                      <span className="hub-record-icon">
                        <Package size={20} />
                      </span>
                      <div>
                        <h2>{order.number}</h2>
                        <p>
                          {order.user?.name ?? 'Customer'} · {when(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="hub-record-body">
                    <div>
                      <span>ITEMS</span>
                      <strong>
                        {order.items.map((item) => `${item.qty} × ${item.name}`).join(', ') || 'Store order'}
                      </strong>
                    </div>
                    <div>
                      <span>ORDER TOTAL</span>
                      <strong>{rupees(order.total)}</strong>
                    </div>
                  </div>
                  {order.delivery && order.delivery.pickupCode && ['PACKED', 'READY_FOR_PICKUP'].includes(order.status) && (
                    <div className="hub-handoff-note"><Package size={17} /><span>Rider pickup code <strong>{order.delivery.pickupCode}</strong> · Share it only when the parcel is ready at the counter.</span></div>
                  )}
                  {order.delivery && order.status === 'READY_FOR_PICKUP' && <p className="hub-wait-note">Ready for the rider. The order completes after the customer confirms delivery.</p>}
                  {next && (
                    <div className="hub-record-actions">
                      <span>
                        Next step <ChevronRight size={15} /> {next.label}
                      </span>
                      <button
                        disabled={working === order.id}
                        onClick={() => void run(order.id, next.action, 'order')}
                      >
                        {working === order.id ? 'Updating…' : next.label} <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <HubEmpty
            title="No orders just yet"
            body="When a customer places an order with your store, it will appear here."
          />
        )
      ) : reservations.length ? (
        <div className="hub-records">
          {reservations.map((reservation) => {
            const next = nextReservationAction(reservation)
            return (
              <article className="hub-record" key={reservation.id}>
                <div className="hub-record-top">
                  <div>
                    <span className="hub-record-icon violet">
                      <QrCode size={20} />
                    </span>
                    <div>
                      <h2>{reservation.code}</h2>
                      <p>Reserved {when(reservation.createdAt)}</p>
                    </div>
                  </div>
                  <StatusPill status={reservation.status} />
                </div>
                <div className="hub-record-body">
                  <div>
                    <span>ITEMS TO PREPARE</span>
                    <strong>
                      {reservation.items
                        .map((item) => `${item.qty} × ${item.product?.name ?? 'Product'}`)
                        .join(', ')}
                    </strong>
                  </div>
                  <div>
                    <span>PICKUP WINDOW</span>
                    <strong>
                      <CalendarClock size={16} /> {reservation.pickupWindow}
                    </strong>
                  </div>
                </div>
                {next && (
                  <div className="hub-record-actions">
                    <span>
                      <CheckCircle2 size={15} /> Keep the customer updated at each step
                    </span>
                    <button
                      disabled={working === reservation.id}
                      onClick={() => void run(reservation.id, next.action, 'reservation')}
                    >
                      {working === reservation.id ? 'Updating…' : next.label} <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <HubEmpty
          title="No reservations right now"
          body="Customers can reserve items from your store and pick them up at a time that suits them."
        />
      )}
    </div>
  )
}
