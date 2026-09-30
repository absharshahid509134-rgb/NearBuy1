// NearBuy domain model — Local Commerce OS core entities

export type CategoryId =
  | 'sports'
  | 'electronics'
  | 'stationery'
  | 'fashion'
  | 'home'
  | 'grocery'
  | 'handmade'
  | 'gifts'

export interface Category {
  id: CategoryId
  name: string
  emoji: string
  tint: string // very light background
  accent: string // icon/text accent
}

export interface Store {
  id: string
  name: string
  slug: string
  category: CategoryId
  blurb: string
  rating: number
  reviews: number
  /** coordinates around Dwarka, Delhi (demo city) */
  lat: number
  lng: number
  area: string
  address: string
  open: boolean
  hours: string
  opensAt: string
  verified: boolean
  pickup: boolean
  localDelivery: boolean
  prepMins: number
  cover?: string
  emoji: string
  followers: number
  since: number
  localMaker?: boolean
  // Store health score components (seller-facing transparency)
  health: {
    inventoryAccuracy: number
    orderAcceptance: number
    reservationConfirm: number
    prepTime: number
    cancellation: number
    satisfaction: number
  }
}

export interface Product {
  id: string
  name: string
  brand: string
  category: CategoryId
  description: string
  /** representative / online listing price */
  price: number
  mrp: number
  rating: number
  ratingCount: number
  online: { price: number; etaDaysMin: number; etaDaysMax: number } | null
  tags: string[]
  emoji: string
  frequentlyBought?: boolean
  /** persisted product image (uploaded by the seller) — rendered when present */
  cover?: string
  images?: string[]
}

export interface Listing {
  productId: string
  storeId: string
  price: number
  stock: number
  /** minutes since the store last updated this inventory */
  updatedMinsAgo: number
  reserveable: boolean
}

export type AvailabilityConfidence = 'fresh' | 'stale' | 'unknown'

export type FulfillmentType = 'standard' | 'fast' | 'pickup' | 'local' | 'reserve'

export interface Offer {
  id: string
  title: string
  kind: 'cheapest' | 'fast' | 'local' | 'bundle' | 'coupon' | 'limited'
  productId?: string
  storeId?: string
  savings: number
  detail: string
  endsIn?: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'picked_up'
  | 'cancelled'
  | 'returned'

export type ReservationStatus =
  | 'awaiting'
  | 'confirmed'
  | 'packed'
  | 'ready'
  | 'collected'
  | 'expired'
  | 'cancelled'

export interface OrderItem {
  productId: string
  storeId: string
  qty: number
  price: number
}

export interface Order {
  id: string
  serverId?: string
  handoffCode?: string
  items: OrderItem[]
  status: OrderStatus
  fulfillment: FulfillmentType
  total: number
  deliveryFee: number
  placedAt: number
  etaMins?: number
  courier?: string
  timeline: { label: string; at: number }[]
}

export interface Reservation {
  id: string
  serverId?: string
  code: string
  items: OrderItem[]
  status: ReservationStatus
  storeId: string
  placedAt: number
  window: string
  expiresAt: number
  timeline: { label: string; at: number }[]
}

export interface Review {
  id: string
  storeId: string
  author: string
  rating: number
  text: string
  when: string
}

export interface DemandSignal {
  area: string
  query: string
  searches: number
  availability: 'low' | 'medium' | 'high'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  productIds?: string[]
  storeIds?: string[]
  chips?: string[]
}
