import { Body, Controller, Get, HttpCode, Inject, Module, Param, Patch, Post } from '@nestjs/common'
import { deliveryEventSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import type { NotificationBus } from '@nearbuy/notifications'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/guards'
import { InventoryService, InventoryModule } from '../inventory/inventory.module'
/**
 * Delivery — partner job lifecycle: receive job → accept → at store → pick up →
 * at customer → OTP/QR verify → delivered → earnings. Statuses live on Delivery,
 * independent of order/payment/fulfillment status.
 */



type EventInput = z.infer<typeof deliveryEventSchema>

const NEXT: Record<string, string[]> = {
  // Assignments must go through /jobs/:id/accept (atomically claimed).
  PENDING: [],
  ASSIGNED: ['AT_STORE', 'CANCELLED'],
  AT_STORE: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['AT_CUSTOMER', 'FAILED'],
  AT_CUSTOMER: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
}

@Controller('delivery')
@Roles('DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN')
export class DeliveryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(INJECTION.NOTIFY) private readonly notify: NotificationBus,
  ) {}

  /** Available jobs (unassigned local deliveries) — pickup/drop/fee/distance. */
  @Get('jobs')
  async jobs(@CurrentUser() user: AuthUser) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId: user.id } })
    const available = await this.prisma.delivery.findMany({
      where: { status: 'PENDING', partnerId: null },
      include: {
        order: {
          include: {
            store: { select: { name: true, area: true, address: true, lat: true, lng: true } },
            items: { select: { name: true, qty: true } },
          },
        },
      },
      take: 20,
    })
    // An admin without a partner profile must not see every rider's jobs:
    // Prisma treats an undefined partnerId filter as no filter at all.
    const mine = partner ? await this.prisma.delivery.findMany({
      where: { partnerId: partner.id, status: { in: ['ASSIGNED', 'AT_STORE', 'PICKED_UP', 'AT_CUSTOMER'] } },
      include: { order: { include: { store: true, items: true } } },
    }) : []
    return {
      available: available.map((d) => shapeJob(d, false)),
      active: mine.map((d) => shapeJob(d, true)),
    }
  }

  @HttpCode(200)
  @Post('jobs/:id/accept')
  async accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId: user.id } })
    if (!partner) throw Errors.forbidden('No delivery partner profile.')
    if (!partner.available) throw Errors.invalidTransition('Go online before accepting a delivery.')
    const delivery = await this.prisma.delivery.findUnique({ where: { id }, include: { order: true } })
    if (!delivery || delivery.status !== 'PENDING') throw Errors.invalidTransition('Job is no longer available.')
    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update makes claiming a job safe when two riders tap Accept
      // at once. Only the first transaction can transition PENDING → ASSIGNED.
      const claimed = await tx.delivery.updateMany({
        where: { id, status: 'PENDING', partnerId: null },
        data: { partnerId: partner.id, status: 'ASSIGNED' },
      })
      if (!claimed.count) throw Errors.invalidTransition('Job is no longer available.')
      await tx.deliveryEvent.create({ data: { deliveryId: id, status: 'ASSIGNED' } })
      await tx.order.update({
        where: { id: delivery.orderId },
        data: {
          events: [
            ...(((delivery.order.events as { label: string; at: string }[]) ?? [])),
            { label: 'Driver Assigned', at: new Date().toISOString() },
          ] as never,
        },
      })
      return tx.delivery.findUniqueOrThrow({ where: { id } })
    })
    await this.notify.driverAssigned(delivery.order.userId)
    return updated
  }

  @HttpCode(200)
  @Post(':id/events')
  async event(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(deliveryEventSchema)) body: EventInput) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id }, include: { order: { include: { payment: true } } } })
    if (!delivery) throw Errors.notFound('Delivery not found.')
    if (!delivery.partnerId) throw Errors.forbidden('Accept this job before updating its status.')
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: delivery.partnerId } })
    if (!partner || (partner.userId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role))) throw Errors.forbidden()
    if (!(NEXT[delivery.status] ?? []).includes(body.status)) {
      throw Errors.invalidTransition(`Cannot move delivery from ${delivery.status} to ${body.status}.`)
    }
    // The store must finish packing before a rider can mark the parcel picked
    // up. A correct code alone must not skip seller preparation.
    if (body.status === 'PICKED_UP' && delivery.order.status !== 'READY_FOR_PICKUP') {
      throw Errors.invalidTransition('The store has not marked this order ready yet.')
    }
    // OTP/QR verification at handover points
    if (body.status === 'PICKED_UP' && delivery.pickupCode && body.code !== delivery.pickupCode) {
      throw Errors.badRequest('Enter the store pickup code to continue.', 'BAD_PICKUP_CODE')
    }
    if (body.status === 'DELIVERED' && delivery.dropCode && body.code !== delivery.dropCode) {
      throw Errors.badRequest('Enter the customer handoff code to complete this job.', 'BAD_DELIVERY_CODE')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Consume the expected status exactly once. Concurrent taps must not
      // complete a delivery twice or credit the rider twice.
      const advanced = await tx.delivery.updateMany({
        where: { id, partnerId: delivery.partnerId, status: delivery.status },
        data: { status: body.status },
      })
      if (!advanced.count) throw Errors.invalidTransition('This delivery has changed. Refresh to see its current status.')
      await tx.deliveryEvent.create({ data: { deliveryId: id, status: body.status, note: body.note } })
      // Order preparation is the seller's state; picking up a package must not
      // move a PACKED order backwards to PREPARING.
      if (body.status === 'DELIVERED') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            status: 'COMPLETED',
            events: [...(((delivery.order.events as { label: string; at: string }[]) ?? [])), { label: 'Delivered', at: new Date().toISOString() }] as never,
          },
        })
        await tx.fulfillment.updateMany({ where: { orderId: delivery.orderId }, data: { status: 'COMPLETED' } })
        // settle pay-on-delivery
        await tx.payment.updateMany({ where: { orderId: delivery.orderId, method: 'COD', status: 'PENDING' }, data: { status: 'PAID' } })
        // Commit inventory, order, payment and rider earnings together.
        await this.inventory.fulfill(tx, delivery.orderId)
        if (delivery.partnerId) {
          await tx.deliveryPartner.update({
            where: { id: delivery.partnerId },
            data: { deliveries: { increment: 1 }, earningsCt: { increment: Number(delivery.fee) * 0.8 } },
          })
        }
      }
      return tx.delivery.findUniqueOrThrow({ where: { id } })
    })
    if (body.status === 'DELIVERED') await this.notify.delivered(delivery.order.userId)
    if (body.status === 'PICKED_UP') await this.notify.outForDelivery(delivery.order.userId)
    return updated
  }

  @Get('earnings')
  async earnings(@CurrentUser() user: AuthUser) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { userId: user.id },
      include: { deliveriesList: { where: { status: 'DELIVERED' }, include: { order: { select: { number: true, total: true } } } } },
    })
    return {
      balance: partner?.earningsCt ?? 0,
      completed: partner?.deliveries ?? 0,
      recent: (partner?.deliveriesList ?? []).slice(-10).map((d) => ({ order: d.order.number, fee: Number(d.fee) })),
    }
  }

  @Get('performance')
  async performance(@CurrentUser() user: AuthUser) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId: user.id } })
    return {
      rating: partner?.rating ?? 5,
      deliveries: partner?.deliveries ?? 0,
      zone: partner?.zone ?? 'Dwarka',
      available: partner?.available ?? true,
      vehicle: partner?.vehicle ?? 'bike',
    }
  }

  /** A rider can decide when they are available; their current job remains assigned. */
  @Roles('DELIVERY_PARTNER')
  @Patch('availability')
  async availability(@CurrentUser() user: AuthUser, @Body() body: { available?: boolean }) {
    if (typeof body?.available !== 'boolean') throw Errors.badRequest('Choose a valid availability status.')
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId: user.id } })
    if (!partner) throw Errors.forbidden('No delivery partner profile.')
    const updated = await this.prisma.deliveryPartner.update({ where: { id: partner.id }, data: { available: body.available } })
    return { available: updated.available }
  }

  /** Driver demand heatmap (High/Medium/Low) — aggregated, safety-aware. */
  @Public()
  @Get('heatmap')
  async heatmap() {
    const zones = ['Sector 22', 'Sector 21', 'Sector 23', 'Sector 19']
    return zones.map((z) => ({ zone: z, demand: z === 'Sector 22' ? 'HIGH' : z === 'Sector 21' ? 'MEDIUM' : 'LOW' }))
  }
}

interface JobRow {
  id: string
  status: string
  fee: unknown
  distanceKm: number
  order: {
    number: string
    addressSnap?: unknown
    items: { name: string; qty: number }[]
    store: { name: string; area: string; address: string } | null
  }
}

function shapeJob(d: JobRow, assigned: boolean) {
  const address = d.order.addressSnap && typeof d.order.addressSnap === 'object'
    ? d.order.addressSnap as Record<string, unknown>
    : {}
  // A rider sees a coarse area before accepting. Full address is private to
  // the assigned rider. Never return pickup/drop verification codes: those
  // must come from the store and customer at handoff.
  const drop = assigned
    ? [address.line1, address.area, address.city].filter((part): part is string => typeof part === 'string' && !!part.trim()).join(', ') || 'Customer address'
    : typeof address.area === 'string' ? address.area : 'Your delivery zone'
  return {
    id: d.id,
    status: d.status,
    fee: Number(d.fee),
    distanceKm: d.distanceKm,
    packageCount: d.order.items.reduce((s, i) => s + i.qty, 0),
    pickup: d.order.store ? { name: d.order.store.name, area: d.order.store.area, address: d.order.store.address } : null,
    items: d.order.items,
    number: d.order.number,
    drop,
  }
}

@Module({ controllers: [DeliveryController], imports: [InventoryModule] })
export class DeliveryModule {}
