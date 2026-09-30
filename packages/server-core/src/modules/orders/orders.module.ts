import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post, Query } from '@nestjs/common'
import type { NotificationBus } from '@nearbuy/notifications'
import type { PaymentProvider } from '@nearbuy/payments'
import type { AnalyticsProvider } from '@nearbuy/analytics'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
import { InventoryService, InventoryModule } from '../inventory/inventory.module'
import { orderToJson } from '../../common/http'
import type { OrderStatus, Prisma } from '@prisma/client'
/**
 * Orders — history, tracking, cancellation (inventory release + refund),
 * seller status transitions. Order status ≠ payment status ≠ fulfillment
 * status ≠ delivery status — they are modeled separately.
 */

const CUSTOMER_CANCELABLE: OrderStatus[] = ['PENDING', 'CONFIRMED']
const SELLER_ACTIONS: Record<string, { from: OrderStatus[]; to: OrderStatus; fulfillment?: string }> = {
  accept: { from: ['PENDING'], to: 'CONFIRMED', fulfillment: 'ACCEPTED' },
  preparing: { from: ['CONFIRMED'], to: 'PREPARING', fulfillment: 'PREPARING' },
  packed: { from: ['PREPARING', 'CONFIRMED'], to: 'PACKED', fulfillment: 'READY' },
  ready: { from: ['PACKED'], to: 'READY_FOR_PICKUP', fulfillment: 'READY' },
  complete: { from: ['READY_FOR_PICKUP', 'PACKED'], to: 'COMPLETED', fulfillment: 'COMPLETED' },
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(INJECTION.PAYMENTS) private readonly payments: PaymentProvider,
    @Inject(INJECTION.NOTIFY) private readonly notify: NotificationBus,
    @Inject(INJECTION.ANALYTICS) private readonly analytics: AnalyticsProvider,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('role') role?: string) {
    // Sellers see their store orders when role=seller (ownership checked).
    if (role === 'seller') {
      const stores = await this.prisma.store.findMany({ where: { seller: { userId: user.id } }, select: { id: true } })
      const orders = await this.prisma.order.findMany({
        where: { storeId: { in: stores.map((s) => s.id) }, ...(status ? { status: status as OrderStatus } : {}) },
        include: { items: true, fulfillment: true, payment: true, delivery: { select: { status: true, pickupCode: true } }, user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return orders.map(orderToJson)
    }
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id, ...(status ? { status: status as OrderStatus } : {}) },
      include: { items: true, fulfillment: true, payment: true, delivery: { select: { status: true, dropCode: true, partner: { select: { user: { select: { name: true } } } } } }, store: { select: { name: true, slug: true, area: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return orders.map(orderToJson)
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { slug: true, emoji: true } } } },
        fulfillment: true,
        payment: true,
        delivery: { include: { events: true } },
        reservation: true,
        store: true,
      },
    })
    if (!order) throw Errors.notFound('Order not found.')
    await this.assertAccess(user, order)
    // The pickup code belongs at the store, the drop code belongs with the
    // customer. A seller must never see the customer's delivery secret.
    const admin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
    return orderToJson({
      ...order,
      delivery: order.delivery ? {
        ...order.delivery,
        pickupCode: admin || order.userId !== user.id ? order.delivery.pickupCode : undefined,
        dropCode: admin || order.userId === user.id ? order.delivery.dropCode : undefined,
      } : null,
    })
  }

  /** Tracking view — timeline + delivery events + live ETA. */
  @Get(':id/track')
  async track(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { fulfillment: true, delivery: { include: { events: { orderBy: { createdAt: 'asc' } }, partner: { include: { user: { select: { name: true } } } } } }, store: true },
    })
    if (!order) throw Errors.notFound('Order not found.')
    await this.assertAccess(user, order)
    return {
      number: order.number,
      status: order.status,
      fulfillment: order.fulfillment,
      delivery: order.delivery
        ? {
            status: order.delivery.status,
            etaMins: order.fulfillment?.etaMins,
            courier: order.delivery.partner?.user?.name ?? 'Assigning shortly…',
            events: order.delivery.events,
          }
        : null,
      store: order.store ? { name: order.store.name, area: order.store.area, address: order.store.address } : null,
      timeline: order.events,
    }
  }

  /** Customer cancellation — releases inventory and refunds captured payments. */
  @HttpCode(200)
  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { payment: true } })
    if (!order || order.userId !== user.id) throw Errors.notFound('Order not found.')
    if (!CUSTOMER_CANCELABLE.includes(order.status)) {
      throw Errors.invalidTransition('This order can no longer be cancelled.')
    }
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.release(tx, undefined, order.id)
      await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          events: appendEvent(order.events, 'Cancelled'),
        },
      })
      await tx.fulfillment.updateMany({ where: { orderId: id }, data: { status: 'CANCELLED' } })
      await tx.delivery.updateMany({ where: { orderId: id }, data: { status: 'CANCELLED' } })
    })
    if (order.payment?.status === 'PAID') {
      const refund = await this.payments.refund(order.payment.providerRef ?? '', Number(order.payment.amount))
      await this.prisma.payment.update({
        where: { orderId: id },
        data: { status: 'REFUNDED', refunds: { create: { amount: order.payment.amount, reason: 'order cancelled', status: refund.ok ? 'COMPLETED' : 'PENDING' } } },
      })
    }
    return orderToJson(await this.prisma.order.findUnique({ where: { id }, include: { payment: true } }))
  }

  /** Seller/admin order progression. */
  @HttpCode(200)
  @Roles('SELLER', 'STORE_STAFF', 'ADMIN', 'SUPER_ADMIN')
  @Post(':id/:action')
  async sellerAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('action') action: string) {
    const spec = SELLER_ACTIONS[action]
    if (!spec) throw Errors.badRequest('Unknown action.')
    const order = await this.prisma.order.findUnique({ where: { id }, include: { store: { include: { seller: true } } } })
    if (!order) throw Errors.notFound('Order not found.')
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      const isOwner = order.store?.seller.userId === user.id
      const isStaff = order.storeId
        ? await this.prisma.storeStaff.findFirst({ where: { storeId: order.storeId, userId: user.id } })
        : null
      if (!isOwner && !isStaff) throw Errors.forbidden()
    }
    if (!spec.from.includes(order.status)) {
      throw Errors.invalidTransition(`Cannot ${action} an order in status ${order.status}.`)
    }
    if (action === 'complete' && !['NEARBY_PICKUP', 'RESERVE_AND_PICKUP'].includes(order.fulfillmentMethod)) {
      throw Errors.invalidTransition('The rider completes a delivery order after the customer handoff.')
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id },
        data: { status: spec.to, events: appendEvent(order.events, labelFor(action)) },
      })
      if (spec.fulfillment) {
        await tx.fulfillment.updateMany({ where: { orderId: id }, data: { status: spec.fulfillment as never } })
      }
      if (spec.to === 'COMPLETED') {
        await this.inventory.fulfill(tx, id)
        // settle pay-on-delivery payments
        await tx.payment.updateMany({ where: { orderId: id, method: 'COD', status: 'PENDING' }, data: { status: 'PAID' } })
      }
      return u
    })
    return orderToJson(updated)
  }

  private async assertAccess(user: AuthUser, order: { userId: string; storeId: string | null }) {
    if (order.userId === user.id) return
    if (['ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT'].includes(user.role)) return
    if (order.storeId) {
      const staff = await this.prisma.storeStaff.findFirst({ where: { storeId: order.storeId, userId: user.id } })
      const store = await this.prisma.store.findFirst({ where: { id: order.storeId, seller: { userId: user.id } } })
      if (staff || store) return
    }
    throw Errors.forbidden()
  }
}

type EventList = { label: string; at: string }[] | null
function appendEvent(events: unknown, label: string): never {
  const list = Array.isArray(events) ? (events as EventList) : []
  return [...(list ?? []), { label, at: new Date().toISOString() }] as never
}
function labelFor(action: string): string {
  return { accept: 'Order Confirmed', preparing: 'Seller Preparing', packed: 'Packed', ready: 'Ready for Pickup', complete: 'Completed' }[action] ?? action
}

@Module({ controllers: [OrdersController], imports: [InventoryModule] })
export class OrdersModule {}
