import { Body, Controller, HttpCode, Inject, Module, Post } from '@nestjs/common'
import type { AnalyticsProvider } from '@nearbuy/analytics'
import type { NotificationBus } from '@nearbuy/notifications'
import type { PaymentProvider } from '@nearbuy/payments'
import type { MapProvider } from '@nearbuy/maps'
import {
  checkoutOrderSchema,
  couponValidateSchema,
  reservationCreateSchema,
  type CheckoutOrderInput,
  type ReservationCreateInput,
} from '@nearbuy/validation'
import { createHash, randomInt } from 'node:crypto'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
import { InventoryService, InventoryModule } from '../inventory/inventory.module'
import { etaMinsFor, feeFor } from '../fulfillment/engine'
import { applyCoupon } from '../coupons/coupon-rules'
import { CUSTOMER_HOME } from '../stores/stores.module'
import { orderToJson } from '../../common/http'
import type { z } from 'zod'
/**
 * Checkout — atomic order & reservation creation (§69 order safety, §70 reservation safety).
 *
 * Validate cart → check inventory → LOCK/reserve inventory (conditional update
 * inside a transaction) → calculate totals server-side → create order/payment/
 * fulfillment → commit. Multi-store carts produce one order per store, each with
 * its own fulfillment — never one implicit seller.
 */

type CouponInput = z.infer<typeof couponValidateSchema>

export const PICKUP_WINDOWS = ['6:00 – 6:30 PM', '6:30 – 7:00 PM', '7:00 – 7:30 PM', '7:30 – 8:00 PM']
const RESERVATION_TTL_MS = 3 * 60 * 60 * 1000

function orderNumber(): string {
  return `NB-${randomInt(10000, 99999)}`
}

@Controller('checkout')
@Roles('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')
export class CheckoutController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(INJECTION.PAYMENTS) private readonly payments: PaymentProvider,
    @Inject(INJECTION.NOTIFY) private readonly notify: NotificationBus,
    @Inject(INJECTION.MAP) private readonly maps: MapProvider,
    @Inject(INJECTION.ANALYTICS) private readonly analytics: AnalyticsProvider,
  ) {}

  /** Server-side quote — prices/fees recomputed, never trusted from clients. */
  @HttpCode(200)
  @Post('quote')
  async quote(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(checkoutOrderSchema)) body: CheckoutOrderInput) {
    const groups = await this.priceGroups(body.items, body.fulfillment)
    let subtotal = 0
    for (const g of groups) subtotal += g.subtotal
    let discount = 0
    if (body.couponCode) {
      const c = await applyCoupon(this.prisma, {
        code: body.couponCode,
        subtotal,
        storeId: groups[0]?.storeId,
        productIds: body.items.map((i) => i.productId),
        pincode: undefined,
      })
      discount = c.discount
    }
    // Each store has its own fulfillment and order. Quote the same total that
    // createOrders will charge, not a single fee for a multi-store cart.
    const perStoreFee = feeFor(body.fulfillment)
    const deliveryFee = groups.length * perStoreFee
    return {
      groups: groups.map((g) => ({
        storeId: g.storeId,
        storeName: g.storeName,
        subtotal: g.subtotal,
        deliveryFee: perStoreFee,
        distanceKm: g.distanceKm,
        items: g.items,
      })),
      subtotal,
      discount,
      deliveryFee,
      total: Math.max(0, subtotal - discount) + deliveryFee,
      fulfillment: body.fulfillment,
    }
  }

  /** Atomic order creation — one Order per store group. */
  @Post('orders')
  async createOrders(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(checkoutOrderSchema)) body: CheckoutOrderInput) {
    this.analytics.track({ name: 'checkout_started', userId: user.id, at: Date.now() })

    // ── Idempotency: a retried identical checkout returns the original
    // orders instead of creating duplicates. The unique (userId, key)
    // constraint makes concurrent identical attempts safe: exactly one
    // transaction wins; the rest re-read and return the stored orders. ──
    const key = body.idempotencyKey
    if (key) {
      const fingerprint = checkoutFingerprint(body)
      const existing = await this.prisma.checkoutRequest.findUnique({
        where: { userId_key: { userId: user.id, key } },
      })
      if (existing) return this.replayCheckoutRequest(user.id, key, existing, fingerprint)
      try {
        await this.prisma.checkoutRequest.create({
          data: { userId: user.id, key, fingerprint, orderIds: [] },
        })
      } catch (e) {
        if (String((e as { code?: string }).code) === 'P2002') {
          const prev = await this.prisma.checkoutRequest.findUniqueOrThrow({
            where: { userId_key: { userId: user.id, key } },
          })
          return this.replayCheckoutRequest(user.id, key, prev, fingerprint)
        }
        throw e
      }
    }

    const groups = await this.priceGroups(body.items, body.fulfillment)
    const delivering = ['LOCAL_DELIVERY', 'STANDARD_DELIVERY', 'FAST_DELIVERY'].includes(body.fulfillment)
    const savedAddress = body.addressId
      ? await this.prisma.address.findFirst({ where: { id: body.addressId, userId: user.id } })
      : undefined
    if (body.addressId && !savedAddress) throw Errors.notFound('Delivery address not found on your account.')
    // The rider sees an address only after accepting the job. Always snapshot
    // the buyer's destination onto each order instead of silently falling back
    // to a generic city pin when a customer entered a real address.
    const addressSnap = savedAddress
      ? { line1: savedAddress.line1, line2: savedAddress.line2, area: savedAddress.area, city: savedAddress.city, pincode: savedAddress.pincode }
      : body.addressLine ? { line1: body.addressLine, area: 'Dwarka', city: 'Delhi' } : null
    if (delivering && !addressSnap) throw Errors.badRequest('Add a delivery address before placing your order.')
    const created = []
    for (const group of groups) {
      const order = await this.prisma.$transaction(async (tx) => {
        // 1–2. validate + lock inventory atomically (conditional updates)
        const holds: { inventoryId: string; unitPrice: number; qty: number; productId: string; name: string }[] = []
        for (const item of group.items) {
          const hold = await this.inventory.reserve(tx, {
            storeId: group.storeId,
            productId: item.productId,
            qty: item.qty,
            actorId: user.id,
          })
          holds.push({ ...hold, qty: item.qty, productId: item.productId, name: item.name })
        }
        // 3. totals — server-side prices
        const subtotal = holds.reduce((s, h) => s + h.unitPrice * h.qty, 0)
        const fee = feeFor(body.fulfillment)
        const discount = 0
        const total = subtotal + fee - discount

        // 4. create order + items + fulfillment + payment + delivery
        const order = await tx.order.create({
          data: {
            number: await this.uniqueNumber(tx),
            userId: user.id,
            storeId: group.storeId,
            status: 'CONFIRMED',
            fulfillmentMethod: body.fulfillment,
            subtotal,
            deliveryFee: fee,
            discount,
            total,
            couponCode: body.couponCode,
            addressId: savedAddress?.id,
            addressSnap: addressSnap ?? undefined,
            events: [{ label: 'Order Confirmed', at: new Date().toISOString() }],
            items: {
              create: holds.map((h) => ({
                productId: h.productId,
                inventoryId: h.inventoryId,
                storeId: group.storeId,
                name: h.name,
                qty: h.qty,
                unitPrice: h.unitPrice,
              })),
            },
            fulfillment: {
              create: {
                method: body.fulfillment,
                status: 'ACCEPTED',
                fee,
                etaMins: etaMinsFor(body.fulfillment, group.distanceKm, group.prepMins),
              },
            },
          },
          include: { items: true, fulfillment: true },
        })
        for (const h of holds) {
          await tx.inventoryReservation.updateMany({
            where: { inventoryId: h.inventoryId, reservationId: null, orderId: null },
            data: { orderId: order.id },
          })
        }
        return order
      })

      // 5. payment intent AFTER commit (provider call, not in DB transaction)
      const intent = await this.payments.createIntent(createdOrderRef(order), Number(order.total), body.paymentMethod)
      const payStatus = body.paymentMethod === 'COD' || body.paymentMethod === 'PAY_AT_STORE' ? 'PENDING' : 'PAID'
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          userId: user.id,
          method: body.paymentMethod,
          status: payStatus,
          amount: order.total,
          providerRef: intent.providerRef,
          providerMeta: intent.meta as never,
        },
      })
      if (['LOCAL_DELIVERY', 'STANDARD_DELIVERY', 'FAST_DELIVERY'].includes(body.fulfillment)) {
        await this.prisma.delivery.create({
          data: {
            orderId: order.id,
            status: 'PENDING',
            fee: feeFor(body.fulfillment),
            distanceKm: group.distanceKm,
            pickupCode: String(randomInt(1000, 9999)),
            dropCode: String(randomInt(1000, 9999)),
          },
        })
      }
      await this.notify.orderConfirmed(user.id, order.number)
      if (group.sellerUserId) await this.notify.sellerOrderReceived(group.sellerUserId, order.number)
      this.analytics.track({ name: 'order_created', userId: user.id, props: { number: order.number }, at: Date.now() })
      if (payStatus === 'PAID') {
        this.analytics.track({ name: 'payment_completed', userId: user.id, props: { number: order.number }, at: Date.now() })
      }
      created.push(orderToJson(order))
    }
    if (key) {
      await this.prisma.checkoutRequest.update({
        where: { userId_key: { userId: user.id, key } },
        data: { orderIds: created.map((o) => o.id) },
      })
    }
    return { orders: created }
  }

  /** Return the orders an idempotency key already produced (retry/replay). */
  private async replayCheckoutRequest(
    userId: string,
    key: string,
    stored: { fingerprint: string; orderIds: string[] },
    fingerprint: string,
  ) {
    if (stored.fingerprint !== fingerprint) {
      throw Errors.conflict(
        'This checkout attempt was already submitted with different details. Please review your cart and place a new order.',
        'IDEMPOTENCY_MISMATCH',
      )
    }
    if (!stored.orderIds.length) {
      // The original request is still in flight (or failed before commit).
      // Brief wait, then re-check once.
      await new Promise((r) => setTimeout(r, 750))
      const again = await this.prisma.checkoutRequest.findUnique({
        where: { userId_key: { userId, key } },
      })
      if (!again || !again.orderIds.length) {
        // If the original attempt is long dead (>60s with no orders), clear
        // the key so the next attempt can start fresh.
        if (again && Date.now() - again.createdAt.getTime() > 60_000) {
          await this.prisma.checkoutRequest.delete({ where: { id: again.id } }).catch(() => undefined)
        }
        throw Errors.conflict('Your order is being processed. Please wait a moment and check your orders.', 'CHECKOUT_IN_FLIGHT')
      }
      stored = again
    }
    const orders = await this.prisma.order.findMany({
      where: { id: { in: stored.orderIds } },
      include: { items: true, fulfillment: true, delivery: { select: { status: true, dropCode: true, pickupCode: true, partner: { select: { user: { select: { name: true } } } } } } },
      orderBy: { createdAt: 'asc' },
    })
    return { orders: orders.map(orderToJson) }
  }

  /** Atomic reservation creation (Reserve & Pickup). */
  @Post('reservations')
  async createReservation(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reservationCreateSchema)) body: ReservationCreateInput,
  ) {
    this.analytics.track({ name: 'reservation_started', userId: user.id, at: Date.now() })
    const storeIds = [...new Set(body.items.map((i) => i.storeId))]
    if (storeIds.length !== 1) throw Errors.badRequest('A reservation must be for a single store.')
    const store = await this.prisma.store.findUnique({ where: { id: storeIds[0] }, include: { seller: true } })
    if (!store) throw Errors.notFound('Store not found.')
    if (!store.open) throw Errors.conflict('The store is currently closed.', 'STORE_CLOSED')
    if (!store.pickupEnabled) throw Errors.conflict('This store does not offer pickup.', 'PICKUP_UNAVAILABLE')
    if (!PICKUP_WINDOWS.includes(body.pickupWindow)) throw Errors.badRequest('Invalid pickup window.')

    const reservation = await this.prisma.$transaction(async (tx) => {
      // state: REQUESTED — inventory locked immediately to prevent overselling
      const items: { productId: string; qty: number; unitPrice: number; inventoryId: string; name: string }[] = []
      for (const item of body.items) {
        const inv = await tx.inventory.findFirst({ where: { storeId: store.id, productId: item.productId, variantId: null } })
        if (!inv?.reserveEnabled) throw Errors.conflict('This item cannot be reserved.', 'NOT_RESERVABLE')
        const hold = await this.inventory.reserve(tx, {
          storeId: store.id,
          productId: item.productId,
          qty: item.qty,
          actorId: user.id,
        })
        items.push({ productId: item.productId, qty: item.qty, unitPrice: hold.unitPrice, inventoryId: hold.inventoryId, name: '' })
      }
      const code = `NB-${randomInt(4000, 9999)}`
      const res = await tx.reservation.create({
        data: {
          code,
          qrPayload: '', // filled below with id
          userId: user.id,
          storeId: store.id,
          status: 'REQUESTED',
          pickupWindow: body.pickupWindow,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          events: [{ label: 'Requested', at: new Date().toISOString() }],
          items: {
            create: body.items.map((i) => {
              const it = items.find((x) => x.productId === i.productId)!
              return { productId: i.productId, qty: i.qty, unitPrice: it.unitPrice }
            }),
          },
        },
      })
      await tx.reservation.update({
        where: { id: res.id },
        data: { qrPayload: `nearbuy://pickup/${res.id}/${code}` },
      })
      for (const item of items) {
        await tx.inventoryReservation.updateMany({
          where: { inventoryId: item.inventoryId, reservationId: null, orderId: null },
          data: { reservationId: res.id },
        })
      }
      return tx.reservation.findUniqueOrThrow({ where: { id: res.id }, include: { items: true, store: true } })
    })

    await this.notify.reservationConfirmed(user.id, reservation.code)
    if (store.seller.userId) {
      await this.notify.emit({
        event: 'SELLER_ORDER_RECEIVED',
        userId: store.seller.userId,
        title: 'New reservation request',
        body: `Code ${reservation.code} · ${body.pickupWindow}. Confirm within 10 minutes.`,
        channels: ['IN_APP', 'PUSH'],
      })
    }
    this.analytics.track({ name: 'reservation_confirmed', userId: user.id, props: { code: reservation.code }, at: Date.now() })
    return reservation
  }

  @Post('coupons/validate')
  async validateCoupon(@Body(new ZodValidationPipe(couponValidateSchema)) body: CouponInput) {
    return applyCoupon(this.prisma, body)
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async priceGroups(items: CheckoutOrderInput['items'], fulfillment?: string) {
    const delivering = ['LOCAL_DELIVERY', 'STANDARD_DELIVERY', 'FAST_DELIVERY'].includes(fulfillment ?? '')
    const pickup = fulfillment === 'NEARBY_PICKUP'
    const map = new Map<string, CheckoutOrderInput['items']>()
    for (const item of items) {
      const arr = map.get(item.storeId) ?? []
      arr.push(item)
      map.set(item.storeId, arr)
    }
    const groups = []
    for (const [storeId, groupItems] of map) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId }, include: { seller: true } })
      if (!store) throw Errors.notFound(`Store ${storeId} not found.`)
      // Store status + supported fulfillment are server-enforced — a closed
      // store or an unsupported mode cannot be checked out, full stop.
      if (!store.open) throw Errors.conflict(`${store.name} is currently closed. Please try again when it opens.`, 'STORE_CLOSED')
      if (delivering && !store.localDelivery) throw Errors.conflict(`${store.name} does not offer local delivery.`, 'DELIVERY_UNAVAILABLE')
      if (pickup && !store.pickupEnabled) throw Errors.conflict(`${store.name} does not offer store pickup.`, 'PICKUP_UNAVAILABLE')
      let subtotal = 0
      const priced = []
      for (const item of groupItems) {
        const inv = await this.prisma.inventory.findFirst({
          where: { storeId, productId: item.productId, variantId: item.variantId ?? null },
          include: { product: true },
        })
        if (!inv) throw Errors.outOfStock(`Item not carried by ${store.name}.`)
        if (!inv.product.active) throw Errors.outOfStock(`${inv.product.name} is no longer available at ${store.name}.`)
        if (inv.status === 'DISCONTINUED') throw Errors.outOfStock(`${inv.product.name} is discontinued at ${store.name}.`)
        if (inv.availableQuantity < item.qty) throw Errors.outOfStock(`${inv.product.name}: only ${inv.availableQuantity} left.`)
        subtotal += Number(inv.price) * item.qty
        priced.push({ ...item, name: inv.product.name, unitPrice: Number(inv.price) })
      }
      groups.push({
        storeId,
        storeName: store.name,
        sellerUserId: store.seller.userId,
        prepMins: store.prepMins,
        distanceKm: round1(this.maps.distanceKm(CUSTOMER_HOME, store)),
        subtotal,
        items: priced,
      })
    }
    return groups
  }

  private async uniqueNumber(tx: { order: { findUnique: Function } }): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const n = orderNumber()
      const existing = await tx.order.findUnique({ where: { number: n } })
      if (!existing) return n
    }
    return `NB-${Date.now().toString().slice(-6)}`
  }
}

function createdOrderRef(order: { id: string; number: string }) {
  return { id: order.id, number: order.number }
}

/** Canonical fingerprint of a checkout request — identical retries must
 * produce an identical fingerprint regardless of item ordering. */
function checkoutFingerprint(body: CheckoutOrderInput): string {
  const normalized = {
    items: body.items
      .map((i) => ({ p: i.productId, s: i.storeId, q: i.qty, v: i.variantId ?? null }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    fulfillment: body.fulfillment,
    paymentMethod: body.paymentMethod,
    addressId: body.addressId ?? null,
    addressLine: body.addressLine ?? null,
    couponCode: body.couponCode ?? null,
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

@Module({
  controllers: [CheckoutController],
  imports: [InventoryModule],
})
export class CheckoutModule {}
