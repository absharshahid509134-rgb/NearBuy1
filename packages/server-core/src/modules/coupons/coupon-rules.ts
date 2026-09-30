import type { PrismaClient } from '@prisma/client'
import { Errors } from '../../common/errors'
/**
 * Coupon rules — server-side validation only (§75).
 */

export interface CouponCheck {
  code: string
  subtotal: number
  storeId?: string
  productIds: string[]
  pincode?: string
}

export async function applyCoupon(
  prisma: PrismaClient,
  input: CouponCheck,
): Promise<{ valid: boolean; discount: number; code: string; type: string }> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: input.code.toUpperCase() },
    include: { products: true },
  })
  if (!coupon || !coupon.active) throw Errors.badRequest('Invalid coupon code.', 'COUPON_INVALID')
  const now = new Date()
  if (coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt < now)) {
    throw Errors.gone('COUPON_EXPIRED', 'This coupon has expired.')
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw Errors.gone('COUPON_EXHAUSTED', 'This coupon has reached its usage limit.')
  }
  if (Number(coupon.minOrder) > input.subtotal) {
    throw Errors.badRequest(`Add items worth ₹${Number(coupon.minOrder) - input.subtotal} more to use this coupon.`, 'COUPON_MIN_ORDER')
  }
  if (coupon.storeId && coupon.storeId !== input.storeId) {
    throw Errors.badRequest('This coupon is for a specific store.', 'COUPON_STORE')
  }
  if (coupon.locationPincode && input.pincode && coupon.locationPincode !== input.pincode) {
    throw Errors.badRequest('This coupon is not valid in your area.', 'COUPON_LOCATION')
  }
  if (coupon.products.length) {
    const allowed = new Set(coupon.products.map((p) => p.productId))
    if (!input.productIds.some((p) => allowed.has(p))) {
      throw Errors.badRequest('This coupon applies to specific products.', 'COUPON_PRODUCT')
    }
  }
  if (coupon.firstOrderOnly) {
    const orders = await prisma.order.count({ where: { userId: (input as { userId?: string }).userId ?? '' } })
    if (orders > 0) throw Errors.badRequest('This coupon is for first orders only.', 'COUPON_FIRST_ORDER')
  }
  const discount =
    coupon.type === 'PERCENT'
      ? Math.round((input.subtotal * Number(coupon.value)) / 100)
      : Math.min(Number(coupon.value), input.subtotal)
  return { valid: true, discount, code: coupon.code, type: coupon.type }
}
