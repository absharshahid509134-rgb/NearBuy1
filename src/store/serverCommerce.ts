import type { Order, OrderStatus, Reservation, ReservationStatus } from '../data/types'

/** The gateway and the local storefront use different status labels. Keep the
 * translation at the boundary, so seller/rider progress is reflected on the
 * customer's existing order cards without giving clients authority over it. */
export interface ApiOrder {
  id: string
  number: string
  status: string
  fulfillmentMethod?: string
  total: number | string
  deliveryFee?: number | string
  createdAt: string
  items: { productId?: string; storeId?: string; name: string; qty: number; unitPrice: number | string }[]
  events?: { label: string; at: string }[]
  delivery?: { status: string; dropCode?: string; courier?: string; partner?: { user?: { name: string } } } | null
}
export interface ApiReservation {
  id: string
  code: string
  status: string
  storeId: string
  createdAt: string
  expiresAt?: string
  pickupWindow: string
  events?: { label: string; at: string }[]
  items: { productId?: string; storeId?: string; qty: number; unitPrice?: number | string }[]
}

export function orderFromApi(raw: ApiOrder): Order {
  let status: OrderStatus = ({
    PENDING: 'pending', CONFIRMED: 'confirmed', PREPARING: 'preparing',
    PACKED: 'ready', READY_FOR_PICKUP: 'ready', COMPLETED: raw.delivery ? 'delivered' : 'picked_up',
    CANCELLED: 'cancelled', RETURNED: 'returned',
  } as Record<string, OrderStatus>)[raw.status] ?? 'pending'
  if (raw.delivery?.status === 'PICKED_UP' || raw.delivery?.status === 'AT_CUSTOMER') status = 'out_for_delivery'
  if (raw.delivery?.status === 'DELIVERED') status = 'delivered'
  const fulfilledAt = Date.parse(raw.createdAt) || Date.now()
  return {
    id: raw.number,
    serverId: raw.id,
    items: raw.items.map((item) => ({ productId: item.productId ?? '', storeId: item.storeId ?? '', qty: item.qty, price: Number(item.unitPrice) })),
    status,
    fulfillment: raw.fulfillmentMethod === 'NEARBY_PICKUP' ? 'pickup' : 'local',
    total: Number(raw.total),
    deliveryFee: Number(raw.deliveryFee ?? 0),
    placedAt: fulfilledAt,
    etaMins: status === 'out_for_delivery' ? 20 : undefined,
    courier: raw.delivery ? (raw.delivery.courier ?? raw.delivery.partner?.user?.name ?? 'Rider being assigned') : undefined,
    handoffCode: raw.delivery?.dropCode,
    timeline: raw.events?.map((event) => ({ label: event.label, at: Date.parse(event.at) || fulfilledAt })) ?? [{ label: 'Order placed', at: fulfilledAt }],
  }
}

export function reservationFromApi(raw: ApiReservation): Reservation {
  const status: ReservationStatus = ({
    REQUESTED: 'awaiting', CONFIRMED: 'confirmed', PACKING: 'packed',
    READY_FOR_PICKUP: 'ready', CUSTOMER_ARRIVED: 'ready', COLLECTED: 'collected',
    COMPLETED: 'collected', REJECTED: 'cancelled', CANCELLED: 'cancelled',
    EXPIRED: 'expired', NO_SHOW: 'expired',
  } as Record<string, ReservationStatus>)[raw.status] ?? 'awaiting'
  const placedAt = Date.parse(raw.createdAt) || Date.now()
  return {
    id: raw.code,
    serverId: raw.id,
    code: raw.code,
    storeId: raw.storeId === 'demo-store' ? 's1' : raw.storeId,
    items: raw.items.map((item) => ({ productId: item.productId ?? '', storeId: item.storeId ?? (raw.storeId === 'demo-store' ? 's1' : raw.storeId), qty: item.qty, price: Number(item.unitPrice ?? 0) })),
    status,
    placedAt,
    window: raw.pickupWindow,
    expiresAt: raw.expiresAt ? Date.parse(raw.expiresAt) : placedAt + 3 * 3600_000,
    timeline: raw.events?.map((event) => ({ label: event.label, at: Date.parse(event.at) || placedAt })) ?? [{ label: 'Requested', at: placedAt }],
  }
}
