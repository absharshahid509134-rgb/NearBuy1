import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post, Query } from '@nestjs/common'
import { RESERVATION_TRANSITIONS, type ReservationStatus } from '@nearbuy/types'
import type { NotificationBus } from '@nearbuy/notifications'
import type { AnalyticsProvider } from '@nearbuy/analytics'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
import { InventoryService, InventoryModule } from '../inventory/inventory.module'
/**
 * Reservations — the signature NearBuy feature, with a strict state machine
 * (REQUESTED → CONFIRMED → PACKING → READY_FOR_PICKUP → CUSTOMER_ARRIVED →
 * COLLECTED → COMPLETED + REJECTED/CANCELLED/EXPIRED/NO_SHOW exceptions).
 * Sellers confirm/reject/pack/mark ready/scan/complete; codes + QR are verified
 * server-side.
 */

const ACTION_MAP: Record<string, ReservationStatus> = {
  confirm: 'CONFIRMED',
  reject: 'REJECTED',
  pack: 'PACKING',
  ready: 'READY_FOR_PICKUP',
  arrive: 'CUSTOMER_ARRIVED',
  collect: 'COLLECTED',
  complete: 'COMPLETED',
  no_show: 'NO_SHOW',
}

const ACTION_LABEL: Record<string, string> = {
  confirm: 'Confirmed',
  reject: 'Rejected',
  pack: 'Packed',
  ready: 'Ready',
  arrive: 'Customer Arrived',
  collect: 'Collected',
  complete: 'Completed',
  no_show: 'No Show',
  cancel: 'Cancelled',
}

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(INJECTION.NOTIFY) private readonly notify: NotificationBus,
    @Inject(INJECTION.ANALYTICS) private readonly analytics: AnalyticsProvider,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('role') role?: string, @Query('status') status?: string) {
    await this.expireDue()
    const where =
      role === 'seller'
        ? { store: { seller: { userId: user.id } }, ...(status ? { status: status as ReservationStatus } : {}) }
        : { userId: user.id, ...(status ? { status: status as ReservationStatus } : {}) }
    return this.prisma.reservation.findMany({
      where,
      include: { items: { include: { product: { select: { name: true, emoji: true, slug: true } } } }, store: { select: { name: true, area: true, address: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.expireDue()
    const res = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { name: true, emoji: true, slug: true } } } },
        store: true,
      },
    })
    if (!res) throw Errors.notFound('Reservation not found.')
    const owns = res.userId === user.id
    const staffOfStore =
      ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT'].includes(user.role) ||
      !!(await this.prisma.storeStaff.findFirst({ where: { storeId: res.storeId, userId: user.id } })) ||
      !!(await this.prisma.store.findFirst({ where: { id: res.storeId, seller: { userId: user.id } } }))
    if (!owns && !staffOfStore) throw Errors.forbidden()
    return res
  }

  /** Customer cancellation (from allowed states only). */
  @HttpCode(200)
  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.prisma.reservation.findUnique({ where: { id } })
    if (!res || res.userId !== user.id) throw Errors.notFound('Reservation not found.')
    return this.transition(res, 'CANCELLED', 'Cancelled', user.id, true)
  }

  /**
   * Seller/staff actions — confirm | reject | pack | ready | arrive | scan |
   * collect | complete | no_show. `scan` verifies the customer QR/code.
   */
  @HttpCode(200)
  @Roles('SELLER', 'STORE_STAFF', 'ADMIN', 'SUPER_ADMIN')
  @Post(':id/:action')
  async action(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body?: { code?: string },
  ) {
    await this.expireDue()
    const res = await this.prisma.reservation.findUnique({ where: { id }, include: { store: { include: { seller: true } } } })
    if (!res) throw Errors.notFound('Reservation not found.')
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      const isOwner = res.store.seller.userId === user.id
      const isStaff = await this.prisma.storeStaff.findFirst({ where: { storeId: res.storeId, userId: user.id } })
      if (!isOwner && !isStaff) throw Errors.forbidden()
    }

    if (action === 'scan') {
      // QR / pickup-code verification at handover
      if (body?.code && body.code !== res.code) throw Errors.badRequest('Invalid pickup code.', 'BAD_PICKUP_CODE')
      return this.transition(res, 'COLLECTED', 'Scanned & Collected', user.id, true)
    }
    const to = ACTION_MAP[action]
    if (!to) throw Errors.badRequest('Unknown action.')
    return this.transition(res, to, ACTION_LABEL[action] ?? action, user.id, action === 'complete' || action === 'collect')
  }

  // ── state machine core ────────────────────────────────────────────────────
  private async transition(
    res: { id: string; status: ReservationStatus; events: unknown; code: string; userId: string; expiresAt: Date },
    to: ReservationStatus,
    label: string,
    actorId: string,
    settleStock: boolean,
  ) {
    const allowed = RESERVATION_TRANSITIONS[res.status] ?? []
    if (!allowed.includes(to)) {
      throw Errors.invalidTransition(`Cannot move reservation from ${res.status} to ${to}.`)
    }
    const events = [...(Array.isArray(res.events) ? (res.events as { label: string; at: string }[]) : []), { label, at: new Date().toISOString() }]

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.reservation.update({
        where: { id: res.id },
        data: { status: to, events: events as never },
      })
      if (['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(to)) {
        await this.inventory.release(tx, res.id)
      }
      if (settleStock && to === 'COMPLETED') {
        const holds = await tx.inventoryReservation.findMany({ where: { reservationId: res.id, releasedAt: null } })
        for (const hold of holds) {
          await tx.inventory.update({
            where: { id: hold.inventoryId },
            data: {
              quantity: { decrement: hold.quantity },
              reservedQuantity: { decrement: hold.quantity },
              lastUpdatedAt: new Date(),
            },
          })
          await tx.inventoryReservation.update({ where: { id: hold.id }, data: { releasedAt: new Date() } })
          await tx.inventoryAudit.create({ data: { inventoryId: hold.inventoryId, change: -hold.quantity, reason: 'RESERVATION_FULFILLED', actorId } })
        }
      }
      return u
    })

    if (to === 'CONFIRMED') await this.notify.reservationConfirmed(res.userId, res.code)
    if (to === 'READY_FOR_PICKUP') await this.notify.reservationReady(res.userId, res.code)
    return updated
  }

  /** Lazy expiry — queued jobs can call this too (RESERVATION_EXPIRING events). */
  private async expireDue() {
    const due = await this.prisma.reservation.findMany({
      where: { expiresAt: { lt: new Date() }, status: { in: ['REQUESTED', 'CONFIRMED', 'PACKING', 'READY_FOR_PICKUP'] } },
    })
    for (const res of due) {
      const events = [...(Array.isArray(res.events) ? (res.events as { label: string; at: string }[]) : []), { label: 'Expired', at: new Date().toISOString() }]
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({ where: { id: res.id }, data: { status: 'EXPIRED', events: events as never } })
        await this.inventory.release(tx, res.id)
      })
    }
  }
}

@Module({ controllers: [ReservationsController], imports: [InventoryModule] })
export class ReservationsModule {}
