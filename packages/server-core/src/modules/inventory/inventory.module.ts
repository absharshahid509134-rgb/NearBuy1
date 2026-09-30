import { Body, Controller, Get, Inject, Injectable, Module, Param, Post, Query } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { inventoryBulkSchema, stockConfirmRespondSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { INJECTION, PrismaService, type CacheStore } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
import type { NotificationBus } from '@nearbuy/notifications'
import { confidence } from '../stores/stores.module'
/**
 * Inventory — local stock per store with overselling protection.
 *
 * Safety rules (order safety §69 / reservation safety §70):
 *  - availableQuantity = quantity - reservedQuantity, always updated atomically
 *  - stock movements use conditional updates (WHERE available >= qty) inside
 *    transactions, so concurrent buyers can never oversell
 *  - every change writes InventoryAudit
 *  - bulk/CSV/barcode/POS-ready import routes converge on one service
 */

type BulkInput = z.infer<typeof inventoryBulkSchema>

export interface StockMovement {
  inventoryId: string
  delta: number
  reason: string
  actorId?: string
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically reserve stock for a reservation/order line.
   * Throws OUT_OF_STOCK without side effects when insufficient.
   */
  async reserve(tx: Prisma.TransactionClient, args: {
    storeId: string
    productId: string
    variantId?: string | null
    qty: number
    reservationId?: string
    orderId?: string
    actorId?: string
  }): Promise<{ inventoryId: string; unitPrice: number }> {
    const inv = await tx.inventory.findFirst({
      where: {
        storeId: args.storeId,
        productId: args.productId,
        variantId: args.variantId ?? null,
      },
    })
    if (!inv) throw Errors.outOfStock('This store does not carry the product.')

    const updated = await tx.inventory.updateMany({
      where: { id: inv.id, availableQuantity: { gte: args.qty }, status: { not: 'DISCONTINUED' } },
      data: {
        quantity: { increment: 0 },
        reservedQuantity: { increment: args.qty },
        availableQuantity: { decrement: args.qty },
        lastUpdatedAt: new Date(),
        updatedBy: args.actorId,
        status: inv.quantity - inv.reservedQuantity - args.qty <= 0 ? 'OUT_OF_STOCK' : inv.quantity - inv.reservedQuantity - args.qty <= 4 ? 'LOW_STOCK' : 'IN_STOCK',
      },
    })
    if (updated.count === 0) throw Errors.outOfStock()

    await tx.inventoryReservation.create({
      data: {
        inventoryId: inv.id,
        reservationId: args.reservationId,
        orderId: args.orderId,
        quantity: args.qty,
      },
    })
    await tx.inventoryAudit.create({
      data: {
        inventoryId: inv.id,
        change: -args.qty,
        reason: args.reservationId ? 'RESERVATION_HOLD' : 'ORDER_HOLD',
        actorId: args.actorId,
      },
    })
    return { inventoryId: inv.id, unitPrice: Number(inv.price) }
  }

  /** Release a hold (cancellation/expiry) — restores availability exactly. */
  async release(tx: Prisma.TransactionClient, reservationId?: string, orderId?: string): Promise<void> {
    const where = reservationId ? { reservationId, releasedAt: null } : { orderId, releasedAt: null }
    const holds = await tx.inventoryReservation.findMany({ where })
    for (const hold of holds) {
      await tx.inventory.update({
        where: { id: hold.inventoryId },
        data: {
          reservedQuantity: { decrement: hold.quantity },
          availableQuantity: { increment: hold.quantity },
          lastUpdatedAt: new Date(),
          status: 'IN_STOCK',
        },
      })
      await tx.inventoryReservation.update({ where: { id: hold.id }, data: { releasedAt: new Date() } })
      await tx.inventoryAudit.create({
        data: { inventoryId: hold.inventoryId, change: hold.quantity, reason: 'RELEASE_HOLD' },
      })
    }
  }

  /** Convert holds into a real deduction when an order completes. */
  async fulfill(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const holds = await tx.inventoryReservation.findMany({ where: { orderId, releasedAt: null } })
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
      await tx.inventoryAudit.create({
        data: { inventoryId: hold.inventoryId, change: -hold.quantity, reason: 'FULFILLED' },
      })
    }
  }

  /** Manual / bulk / CSV / barcode / POS_API converge here. */
  async upsert(tx: Prisma.TransactionClient, storeId: string, items: BulkInput['items'], source: string, actorId?: string) {
    for (const item of items) {
      const existing = await tx.inventory.findFirst({
        where: { storeId, productId: item.productId, variantId: null },
      })
      if (existing) {
        await tx.inventory.update({
          where: { id: existing.id },
          data: {
            quantity: item.quantity,
            availableQuantity: Math.max(0, item.quantity - existing.reservedQuantity),
            price: item.price,
            reserveEnabled: item.reserveEnabled,
            lastUpdatedAt: new Date(),
            updatedBy: actorId,
            status: item.quantity <= 0 ? 'OUT_OF_STOCK' : item.quantity <= 4 ? 'LOW_STOCK' : 'IN_STOCK',
          },
        })
        await tx.inventoryAudit.create({
          data: { inventoryId: existing.id, change: item.quantity - existing.quantity, reason: source, actorId },
        })
      } else {
        const created = await tx.inventory.create({
          data: {
            storeId,
            productId: item.productId,
            quantity: item.quantity,
            reservedQuantity: 0,
            availableQuantity: item.quantity,
            price: item.price,
            reserveEnabled: item.reserveEnabled,
            status: item.quantity <= 0 ? 'OUT_OF_STOCK' : item.quantity <= 4 ? 'LOW_STOCK' : 'IN_STOCK',
            updatedBy: actorId,
          },
        })
        await tx.inventoryAudit.create({
          data: { inventoryId: created.id, change: item.quantity, reason: source, actorId },
        })
      }
    }
  }
}

@Controller('inventory')
@Roles('SELLER', 'ADMIN', 'SUPER_ADMIN')
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: InventoryService,
    @Inject(INJECTION.NOTIFY) private readonly notify: NotificationBus,
  ) {}

  private async myStoreIds(user: AuthUser): Promise<string[]> {
    const stores = await this.prisma.store.findMany({
      where: { seller: { userId: user.id } },
      select: { id: true },
    })
    const staff = await this.prisma.storeStaff.findMany({ where: { userId: user.id }, select: { storeId: true } })
    return [...stores.map((s) => s.id), ...staff.map((s) => s.storeId)]
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    const mine = await this.myStoreIds(user)
    if (!mine.length) return []
    const selected = storeId ?? mine[0]
    if (!mine.includes(selected)) throw Errors.forbidden('This store is not on your account.')
    const rows = await this.prisma.inventory.findMany({
      where: { storeId: selected },
      include: { product: { include: { brand: true } } },
      orderBy: { lastUpdatedAt: 'desc' },
    })
    return rows.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.product.name,
      brand: i.product.brand?.name,
      emoji: i.product.emoji,
      quantity: i.quantity,
      reservedQuantity: i.reservedQuantity,
      availableQuantity: i.availableQuantity,
      price: Number(i.price),
      status: i.status,
      confidence: confidence(i.lastUpdatedAt),
      updatedMinsAgo: Math.floor((Date.now() - i.lastUpdatedAt.getTime()) / 60000),
      reserveEnabled: i.reserveEnabled,
    }))
  }

  /** Bulk stock update (also powers CSV import and barcode flows). */
  @Post('bulk')
  async bulk(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(inventoryBulkSchema)) body: BulkInput) {
    const mine = await this.myStoreIds(user)
    if (!mine.length) throw Errors.forbidden('No store on this account.')
    const storeId = mine[0]
    const sync = await this.prisma.$transaction(async (tx) => {
      await this.service.upsert(tx, storeId, body.items, body.source, user.id)
      return tx.inventorySync.create({
        data: { storeId, source: body.source, itemCount: body.items.length, ok: true },
      })
    })
    return sync
  }

  /** CSV import — payload is parsed rows; recorded as InventorySync. */
  @Post('import')
  async importCsv(@CurrentUser() user: AuthUser, @Body() body: { rows: BulkInput['items'] }) {
    if (!Array.isArray(body?.rows) || body.rows.length > 1000) throw Errors.badRequest('Provide up to 1000 rows.')
    return this.bulk(user, { items: body.rows.map((r) => ({ ...r, reserveEnabled: r.reserveEnabled ?? true })), source: 'CSV' })
  }

  @Get('audit')
  async audit(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    const mine = await this.myStoreIds(user)
    if (!mine.length) return []
    const selected = storeId ?? mine[0]
    if (!mine.includes(selected)) throw Errors.forbidden('This store is not on your account.')
    return this.prisma.inventoryAudit.findMany({
      where: { inventory: { storeId: selected } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Get('syncs')
  async syncs(@CurrentUser() user: AuthUser) {
    const mine = await this.myStoreIds(user)
    if (!mine.length) return []
    return this.prisma.inventorySync.findMany({ where: { storeId: mine[0] }, orderBy: { createdAt: 'desc' }, take: 20 })
  }

  /** Live stock confirmation queue (customer "Ask Store to Confirm"). */
  @Get('confirm-requests')
  async confirmRequests(@CurrentUser() user: AuthUser) {
    const mine = await this.myStoreIds(user)
    return this.prisma.stockConfirmRequest.findMany({
      where: { storeId: { in: mine }, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Post('confirm-requests/:id/respond')
  async respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(stockConfirmRespondSchema)) body: { available: boolean },
  ) {
    const mine = await this.myStoreIds(user)
    const req = await this.prisma.stockConfirmRequest.findUnique({ where: { id } })
    if (!req || !mine.includes(req.storeId)) throw Errors.notFound('Request not found.')
    const updated = await this.prisma.stockConfirmRequest.update({
      where: { id },
      data: { status: body.available ? 'AVAILABLE' : 'NOT_AVAILABLE', respondedAt: new Date() },
    })
    if (body.available) {
      // Touch inventory freshness so the customer sees "confirmed recently".
      await this.prisma.inventory.updateMany({
        where: { storeId: req.storeId, productId: req.productId },
        data: { lastUpdatedAt: new Date(), updatedBy: user.id },
      })
    }
    if (req.userId) {
      await this.notify.emit({
        event: 'NEARBY_AVAILABILITY_FOUND',
        userId: req.userId,
        title: body.available ? 'Store confirmed availability' : 'Not available right now',
        body: body.available ? 'The store confirmed your item is available.' : 'The store could not confirm stock.',
        channels: ['IN_APP'],
      })
    }
    return updated
  }
}

@Controller('stock-requests')
export class StockRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.CACHE) private readonly cache: CacheStore,
  ) {}

  /** Customer asks a store to confirm uncertain inventory (rate-limited upstream). */
  @Roles('CUSTOMER')
  @Post()
  async request(
    @CurrentUser() user: AuthUser,
    @Body() body: { storeId: string; productId: string; qty?: number },
  ) {
    if (!body?.storeId || !body?.productId) throw Errors.badRequest('storeId and productId required.')
    if (body.qty !== undefined && (!Number.isInteger(body.qty) || body.qty < 1 || body.qty > 99)) throw Errors.badRequest('Choose a quantity from 1 to 99.')
    const listing = await this.prisma.inventory.findFirst({ where: { storeId: body.storeId, productId: body.productId }, select: { id: true } })
    if (!listing) throw Errors.notFound('This store does not carry that item.')
    const key = `stockreq:${user.id}:${body.productId}:${body.storeId}`
    const n = await this.cache.incr(key, 600)
    if (n > 5) throw Errors.tooMany('You have already asked several times for this item.')
    return this.prisma.stockConfirmRequest.create({
      data: {
        storeId: body.storeId,
        productId: body.productId,
        qty: body.qty ?? 1,
        userId: user.id,
      },
    })
  }

  @Roles('CUSTOMER')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.prisma.stockConfirmRequest.findMany({
      where: { userId: user.id },
      select: { id: true, storeId: true, productId: true, status: true, createdAt: true, respondedAt: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    })
  }

  @Roles('SELLER', 'STORE_STAFF', 'ADMIN', 'SUPER_ADMIN')
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('storeId') storeId: string) {
    if (!storeId) throw Errors.badRequest('Choose a store before viewing stock requests.')
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      const owner = await this.prisma.store.findFirst({ where: { id: storeId, seller: { userId: user.id } }, select: { id: true } })
      const staff = owner ? null : await this.prisma.storeStaff.findFirst({ where: { storeId, userId: user.id } })
      if (!owner && !staff) throw Errors.forbidden('This store is not on your account.')
    }
    return this.prisma.stockConfirmRequest.findMany({
      where: { storeId },
      select: { id: true, storeId: true, productId: true, qty: true, status: true, respondedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    })
  }
}

@Module({
  controllers: [InventoryController, StockRequestsController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
