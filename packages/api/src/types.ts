/**
 * API DTO types — shapes verified against the live gateway (2026-09-26).
 * Domain enums/interfaces come from @nearbuy/types; only wire views live here.
 */
import type { FulfillmentMethod, FulfillmentOption, Role } from '@nearbuy/types'

export type { FulfillmentMethod, FulfillmentOption, Role }

// ── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUserView { id: string; role: Role; name: string }
export interface LoginResult { accessToken: string; refreshToken: string; csrf: string; user: AuthUserView }
export type MeView = AuthUserView

// ── Search (flat hits) ──────────────────────────────────────────────────────
export interface SearchHit {
  productId: string
  slug: string
  name: string
  brand: string
  category: string
  emoji: string
  price: number
  mrp: number
  rating: number
  storesNearby: number
  unitsNearby: number
  closestKm: number | null
  fastestMins: number | null
  openNow: boolean
  pickupToday: boolean
  bestStoreId: string | null
}
export interface ParsedQuery {
  raw: string
  text: string
  openNow: boolean
  availableToday: boolean
  pickup: boolean
  fast: boolean
  chips: string[]
}
export interface SearchResponse {
  parsed: ParsedQuery
  hits: SearchHit[]
  sort: string
  criteriaVisible: boolean
}

// ── Catalog ─────────────────────────────────────────────────────────────────
export interface ProductRow {
  id: string
  name: string
  slug: string
  sku: string
  barcode: string | null
  brandId: string
  categoryId: string
  description: string
  specs: Record<string, string> | null
  tags: string[]
  emoji: string
  active: boolean
  metaTitle: string | null
  metaDesc: string | null
  rating: number
  ratingCount: number
}
export interface PriceRow {
  id: string
  listPrice: number
  mrp: number
  onlinePrice: number
  etaMin: number | null
  etaMax: number | null
}
export interface ProductImage { id: string; url: string; alt: string | null }
export interface ProductDetail extends ProductRow {
  brand: { id: string; name: string; slug: string }
  category: { id: string; name: string; slug: string }
  images: ProductImage[]
  price: PriceRow | null
  variants: Array<{ id: string; name: string; sku: string; priceDelta: number; options: Record<string, string>; stock: number }>
  reviews: Array<{ id: string; rating: number; title: string | null; body: string | null; userName: string; createdAt: string }>
}
export interface CategoryNode { id: string; name: string; slug: string; parentId: string | null; children?: CategoryNode[] }

// ── Stores (rollup rows) ────────────────────────────────────────────────────
export interface StoreNearbyRow {
  id: string
  name: string
  slug: string
  category: string
  area: string
  emoji: string
  verified: boolean
  pickupEnabled: boolean
  localDelivery: boolean
  rating: number
  hours: string
  inStockProducts: number
  distanceKm: number
  travelMins: number
}

// ── Cart ────────────────────────────────────────────────────────────────────
export interface CartItemView {
  id: string
  productId: string
  slug: string
  name: string
  emoji: string
  brand: string
  qty: number
  storeId: string | null
  storeName: string | null
  distanceKm: number | null
  unitPrice: number
  available: boolean
  lineTotal: number
}
export interface CartOptimizer { oneStore: number; twoStores: number; online: number; criteria: string[] }
export interface CartView {
  id: string
  couponCode: string | null
  items: CartItemView[]
  subtotal: number
  storeCount: number
  optimizer: CartOptimizer
}

// ── Checkout ────────────────────────────────────────────────────────────────
export interface CheckoutItem { productId: string; variantId?: string; storeId: string; qty: number }
export interface QuoteGroup { storeId: string; storeName: string; subtotal: number; items: CartItemView[] }
export interface QuoteView { groups: QuoteGroup[]; subtotal: number; deliveryFee: number; discount: number; total: number }

// ── Orders (list rows are raw records; money may serialize as strings) ───────
export type MoneyLike = number | string
export interface OrderEvent { id: string; status: string; note: string | null; createdAt: string }
export interface OrderRow {
  id: string
  number: string
  userId: string
  storeId: string
  status: string
  fulfillmentMethod: string
  subtotal: MoneyLike
  deliveryFee: MoneyLike
  discount: MoneyLike
  total: MoneyLike
  couponCode: string | null
  addressId: string | null
  addressSnap: Record<string, string> | null
  events: OrderEvent[]
  createdAt: string
  updatedAt: string
}
export interface OrderItemView {
  id: string
  productId: string
  name: string
  emoji: string
  qty: number
  unitPrice: MoneyLike
  lineTotal: MoneyLike
  storeId: string | null
}
export interface OrderDetail extends OrderRow {
  items: OrderItemView[]
  payment: { id: string; method: string; status: string; amount: MoneyLike } | null
  store: { id: string; name: string; area: string; phone: string } | null
  canCancel: boolean
  canReturn: boolean
}

// ── Reservations (NB-#### ticket machine) ───────────────────────────────────
export interface ReservationEvent { id: string; status: string; note: string | null; createdAt: string }
export interface ReservationRow {
  id: string
  code: string
  qrPayload: string
  userId: string
  storeId: string
  orderId: string | null
  status: string
  pickupWindow: string
  expiresAt: string
  events: ReservationEvent[]
  items: Array<{ id: string; productId: string; name: string; emoji: string; qty: number }>
  store: { id: string; name: string; area: string; address: string; phone: string; hours: string }
  createdAt: string
}

// ── Addresses ───────────────────────────────────────────────────────────────
export interface AddressView {
  id: string
  label: string
  name: string
  phone: string
  line1: string
  line2: string | null
  area: string
  city: string
  state: string
  pincode: string
  isDefault: boolean
}

// ── Wishlist / Notifications ────────────────────────────────────────────────
export interface WishlistRow { id: string; product: ProductRow & { price?: PriceRow }; createdAt: string }
export interface NotificationRow { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }

// ── Returns (compact ReturnsModule) ─────────────────────────────────────────
export type ReturnReason = 'DAMAGED' | 'WRONG_ITEM' | 'MISSING_ITEMS' | 'DEFECTIVE' | 'SIZE_ISSUE' | 'MIND_CHANGE'
export interface ReturnRequestView {
  id: string
  number: string
  orderId: string
  orderNumber: string
  status: string
  resolution: string
  reason: ReturnReason
  pickupAddress: Record<string, string> | null
  refund: { id: string; status: string; amount: MoneyLike } | null
  items: Array<{ id: string; productId: string; name: string; qty: number; unitPrice: MoneyLike; reason: string }>
  events: Array<{ id: string; status: string; note: string | null; createdAt: string }>
  createdAt: string
}

// ── Seller / Admin ──────────────────────────────────────────────────────────
export interface SellerMeView {
  id: string
  businessName: string
  status: string
  rating: number
  stores: Array<{ id: string; name: string; slug: string; area: string; verified: boolean; open: boolean }>
}
export interface AdminMetrics {
  users: number
  sellers: number
  stores: number
  products: number
  orders: number
  reservations: number
  gmv: MoneyLike
  aov: MoneyLike
}
export interface AuditLogRow { id: string; action: string; actorId: string | null; entity: string; entityId: string | null; meta: Record<string, unknown> | null; createdAt: string }
export interface DemandRadarRow { id: string; query: string; area: string; count: number; intent: string | null; createdAt: string }
export interface AdminUserRow { id: string; name: string; email: string | null; phone: string | null; role: string; status: string; createdAt: string }
export interface AdminSellerRow { id: string; businessName: string; status: string; verified: boolean; user: { id: string; name: string; email: string | null } | null; stores: number }
export interface InventoryRow {
  id: string
  storeId: string
  storeName: string
  productId: string
  productName: string
  sku: string
  price: MoneyLike
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  status: string
}
