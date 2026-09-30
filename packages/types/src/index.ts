/**
 * @nearbuy/types — shared domain types across web, seller, admin, delivery and mobile.
 * Keep this provider-agnostic: no Next.js, no NestJS imports.
 */

// ── Roles ───────────────────────────────────────────────────────────────────
export const ROLES = [
  'CUSTOMER',
  'SELLER',
  'STORE_STAFF',
  'DELIVERY_PARTNER',
  'SUPPORT_AGENT',
  'CONTENT_MANAGER',
  'FINANCE_ADMIN',
  'LOGISTICS_ADMIN',
  'PRODUCT_ADMIN',
  'SELLER_EMPLOYEE',
  'WAREHOUSE_STAFF',
  'SUPER_ADMIN',
  'STORE_STAFF',
  'ADMIN',
] as const
export type Role = (typeof ROLES)[number]

// ── Fulfillment ─────────────────────────────────────────────────────────────
export const FULFILLMENT_METHODS = [
  'STANDARD_DELIVERY',
  'FAST_DELIVERY',
  'LOCAL_DELIVERY',
  'NEARBY_PICKUP',
  'RESERVE_AND_PICKUP',
] as const
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number]

export interface FulfillmentOption {
  method: FulfillmentMethod
  label: string
  estimatedTime: string
  fee: number
  available: boolean
  sellerEligible: boolean
  serviceAreaKm?: number
  storeId?: string
  reason?: string
}

// ── Order / payment / fulfillment / delivery status — intentionally separate ──
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'PACKED',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD', 'PAY_AT_STORE'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const FULFILLMENT_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'HANDED_OVER',
  'COMPLETED',
  'CANCELLED',
] as const
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

export const DELIVERY_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'AT_STORE',
  'PICKED_UP',
  'AT_CUSTOMER',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

// ── Reservation state machine ───────────────────────────────────────────────
export const RESERVATION_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CUSTOMER_ARRIVED',
  'COLLECTED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

/** Allowed transitions for the reservation state machine. */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  REQUESTED: ['CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['PACKING', 'CANCELLED', 'EXPIRED'],
  PACKING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['CUSTOMER_ARRIVED', 'NO_SHOW', 'EXPIRED'],
  CUSTOMER_ARRIVED: ['COLLECTED', 'NO_SHOW'],
  COLLECTED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  NO_SHOW: [],
}

export const RESERVATION_TERMINAL: ReservationStatus[] = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
]

// ── Inventory ───────────────────────────────────────────────────────────────
export const INVENTORY_STATUSES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED'] as const
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number]

export type AvailabilityConfidence = 'FRESH' | 'STALE' | 'UNKNOWN'

// ── Search ──────────────────────────────────────────────────────────────────
export interface SearchChip {
  label: string
  kind: 'price' | 'distance' | 'availability' | 'store' | 'mode' | 'rating' | 'brand' | 'category'
}

export interface ParsedSearch {
  raw: string
  text: string
  maxPrice?: number
  minPrice?: number
  maxDistanceKm?: number
  minRating?: number
  brand?: string
  category?: string
  openNow: boolean
  availableToday: boolean
  pickup: boolean
  fast: boolean
  chips: SearchChip[]
}

export type SearchSort = 'recommended' | 'cheapest' | 'fastest' | 'nearest' | 'rating' | 'available'

// ── API envelopes ───────────────────────────────────────────────────────────
export interface ApiError {
  success: false
  error: { code: string; message: string; details?: unknown }
  requestId: string
}

export interface ApiOk<T> {
  success: true
  data: T
  requestId: string
  meta?: { nextCursor?: string | null; total?: number }
}

export type ApiResponse<T> = ApiOk<T> | ApiError

// ── Analytics events (provider-agnostic) ────────────────────────────────────
export const ANALYTICS_EVENTS = [
  'search_performed',
  'product_viewed',
  'store_viewed',
  'nearby_opened',
  'reservation_started',
  'reservation_confirmed',
  'reservation_cancelled',
  'add_to_cart',
  'checkout_started',
  'order_created',
  'payment_completed',
  'pickup_completed',
  'delivery_completed',
] as const
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

// ── Notification ────────────────────────────────────────────────────────────
export const NOTIFICATION_EVENTS = [
  'ORDER_CONFIRMED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_READY',
  'RESERVATION_EXPIRING',
  'DRIVER_ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PRICE_DROP',
  'BACK_IN_STOCK',
  'NEARBY_AVAILABILITY_FOUND',
  'LOW_STOCK',
  'SELLER_ORDER_RECEIVED',
] as const
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS', 'WHATSAPP'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]
