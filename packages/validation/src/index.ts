import { z } from 'zod'
import { FULFILLMENT_METHODS, PAYMENT_METHODS } from '@nearbuy/types'
/**
 * @nearbuy/validation — Zod schemas shared by API DTO validation and web forms.
 * All API input is validated; these schemas are the single source of truth.
 */

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ── Auth ────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(80),
  // Public registration can create only these three account types. Admin,
  // support, finance and staff roles must be provisioned by trusted staff.
  role: z.enum(['CUSTOMER', 'SELLER', 'DELIVERY_PARTNER']).default('CUSTOMER'),
}).refine((d) => d.email || d.phone, { message: 'Email or phone required' })

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
}).refine((d) => d.email || d.phone, { message: 'Email or phone required' })

export const otpRequestSchema = z.object({ phone: z.string().min(8) })
export const otpVerifySchema = z.object({ phone: z.string().min(8), code: z.string().length(6) })
export const refreshSchema = z.object({ refreshToken: z.string().optional() })

// ── Users ───────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  locale: z.enum(['en', 'hi']).optional(),
  locationMode: z.enum(['CURRENT', 'HOME', 'WORK', 'PINCODE', 'AREA', 'MAP']).optional(),
  locationLabel: z.string().max(120).optional(),
  prefs: z.record(z.unknown()).optional(),
})

export const addressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).default('home'),
  line1: z.string().min(2),
  line2: z.string().optional(),
  area: z.string().min(2),
  city: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
})

// ── Sellers & stores ────────────────────────────────────────────────────────
export const sellerRegisterSchema = z.object({
  legalName: z.string().min(2),
  gstin: z.string().max(20).optional(),
  store: z.object({
    name: z.string().min(2),
    category: z.string().min(2),
    blurb: z.string().max(400).default(''),
    lat: z.number(),
    lng: z.number(),
    area: z.string().min(2),
    address: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    hours: z.string().default('9:00 AM – 9:00 PM'),
    opensAt: z.string().default('9:00 AM'),
    emoji: z.string().default('🏪'),
  }),
})

export const updateStoreSchema = z.object({
  name: z.string().min(2).optional(),
  blurb: z.string().max(400).optional(),
  category: z.string().min(2).optional(),
  address: z.string().min(2).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  phone: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  hours: z.string().optional(),
  opensAt: z.string().optional(),
  open: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  localDelivery: z.boolean().optional(),
  localDeliveryKm: z.number().min(0.5).max(25).optional(),
  prepMins: z.number().int().min(1).max(180).optional(),
  emoji: z.string().optional(),
  coverUrl: z.string().optional(),
})

// ── Products ────────────────────────────────────────────────────────────────
export const productCreateSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().optional(),
  brandName: z.string().optional(),
  categorySlug: z.string().min(2),
  description: z.string().min(2),
  specs: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
  emoji: z.string().default('🛍️'),
  listPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  onlinePrice: z.coerce.number().min(0).optional(),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  // Publish / unpublish toggle (seller can pull a product from discovery).
  active: z.boolean().optional(),
})

export const productImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(140).optional(),
})

// ── Inventory ───────────────────────────────────────────────────────────────
export const inventoryItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
  price: z.coerce.number().min(0),
  reserveEnabled: z.boolean().default(true),
})

export const inventoryBulkSchema = z.object({
  items: z.array(inventoryItemSchema).min(1).max(500),
  source: z.enum(['MANUAL', 'CSV', 'BARCODE', 'POS_API', 'BULK']).default('BULK'),
})

export const stockConfirmRespondSchema = z.object({
  available: z.boolean(),
})

// ── Search ──────────────────────────────────────────────────────────────────
export const searchQuerySchema = z.object({
  q: z.string().default(''),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).default(5),
  category: z.string().optional(),
  brand: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availableNow: z.coerce.boolean().optional(),
  pickup: z.coerce.boolean().optional(),
  openNow: z.coerce.boolean().optional(),
  sort: z.enum(['recommended', 'cheapest', 'fastest', 'nearest', 'rating', 'available']).default('recommended'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ── Cart / checkout ─────────────────────────────────────────────────────────
export const cartAddSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  storeId: z.string().optional(),
  qty: z.coerce.number().int().min(1).max(99).default(1),
})

export const cartUpdateSchema = z.object({ qty: z.coerce.number().int().min(0).max(99) })

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  storeId: z.string().min(1),
  qty: z.coerce.number().int().min(1).max(99),
})

export const checkoutOrderSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  fulfillment: z.enum(FULFILLMENT_METHODS),
  paymentMethod: z.enum(PAYMENT_METHODS).default('UPI'),
  addressId: z.string().optional(),
  addressLine: z.string().trim().min(8).max(180).optional(),
  couponCode: z.string().optional(),
  // Client-generated uuid, stable across retries of the SAME checkout attempt
  // (double-click, refresh, network timeout). Retries with the same key return
  // the original orders; a different cart gets a new key.
  idempotencyKey: z.string().uuid().optional(),
})

export const reservationCreateSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  pickupWindow: z.string().min(4),
})

export const couponValidateSchema = z.object({
  code: z.string().min(3),
  subtotal: z.coerce.number().min(0),
  storeId: z.string().optional(),
  productIds: z.array(z.string()).default([]),
  pincode: z.string().optional(),
})

// ── Reviews / wishlist / notifications ──────────────────────────────────────
export const reviewCreateSchema = z.object({
  productId: z.string().optional(),
  storeId: z.string().optional(),
  orderId: z.string().optional(),
  kind: z.enum(['PRODUCT', 'STORE', 'DELIVERY', 'PICKUP']).default('PRODUCT'),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
})

export const wishlistAddSchema = z.object({ productId: z.string().min(1) })

export const notificationReadSchema = z.object({ ids: z.array(z.string()).min(1) })

// ── Delivery / payments ─────────────────────────────────────────────────────
export const deliveryEventSchema = z.object({
  status: z.enum(['ASSIGNED', 'AT_STORE', 'PICKED_UP', 'AT_CUSTOMER', 'DELIVERED', 'FAILED', 'CANCELLED']),
  note: z.string().max(300).optional(),
  code: z.string().max(12).optional(), // OTP/QR verification
})

export const paymentIntentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
})

// ── AI ──────────────────────────────────────────────────────────────────────
export const aiChatSchema = z.object({
  message: z.string().min(1).max(1000),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SearchInput = z.infer<typeof searchQuerySchema>
export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>
