import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
import { z } from 'zod'

/**
 * Returns & Refunds (compact ReturnsModule) — blueprint §9.
 *
 * State machine:
 *   REQUESTED → APPROVED → PICKUP_SCHEDULED → PICKED_UP → RECEIVED → INSPECTION
 *     → REJECTED
 *     → APPROVED → REFUND_INITIATED → REFUNDED
 *               → REPLACED
 *   REQUESTED → REJECTED
 *
 * Money never moves in the UI: refunds are Refund rows against the original
 * Payment (refund-to-original).
 */

const RETURN_REASONS = ['DAMAGED', 'WRONG_ITEM', 'MISSING_ITEMS', 'DEFECTIVE', 'SIZE_ISSUE', 'MIND_CHANGE'] as const

const returnCreateSchema = z.object({
  orderId: z.string().min(1),
  resolution: z.enum(['REFUND', 'REPLACEMENT']).default('REFUND'),
  items: z
    .array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1), reason: z.enum(RETURN_REASONS) }))
    .min(1),
})
type ReturnCreateInput = z.infer<typeof returnCreateSchema>

const returnActionSchema = z.object({ note: z.string().max(500).optional() })

const ELIGIBLE_STATUSES = ['DELIVERED', 'COMPLETED']
const TRANSITIONS: Record<string, string[]> = {
  Approve: ['REQUESTED'],
  Reject: ['REQUESTED', 'RECEIVED', 'INSPECTION'],
  Schedule: ['APPROVED'],
  Pickup: ['PICKUP_SCHEDULED'],
  Receive: ['PICKED_UP'],
  Inspect: ['RECEIVED'],
  Refund: ['INSPECTION', 'APPROVED'],
  Replace: ['INSPECTION', 'APPROVED'],
}
const NEXT: Record<string, string> = {
  Approve: 'APPROVED',
  Reject: 'REJECTED',
  Schedule: 'PICKUP_SCHEDULED',
  Pickup: 'PICKED_UP',
  Receive: 'RECEIVED',
  Inspect: 'INSPECTION',
  Refund: 'REFUND_INITIATED',
  Replace: 'REPLACED',
}

@Controller('returns')
export class ReturnsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(returnCreateSchema)) body: ReturnCreateInput) {
    const order = await this.prisma.order.findUnique({ where: { id: body.orderId }, include: { items: true } })
    if (!order) throw Errors.notFound('Order not found')
    if (order.userId !== user.id) throw Errors.forbidden('Not your order')
    if (!ELIGIBLE_STATUSES.includes(order.status)) throw Errors.badRequest('Order is not eligible for return')
    if (Date.now() - order.updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw Errors.badRequest('Return window (7 days) has passed')
    }

    const mapped = body.items.map((i) => {
      const oi = order.items.find((x) => x.productId === i.productId)
      if (!oi) throw Errors.badRequest(`Item not on order: ${i.productId}`)
      if (i.qty > oi.qty) throw Errors.badRequest('Return qty exceeds purchased qty')
      return { orderItemId: oi.id, quantity: i.qty, reason: i.reason, status: 'REQUESTED' }
    })

    const created = await this.prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId: user.id,
        type: body.resolution === 'REPLACEMENT' ? 'REPLACEMENT' : 'RETURN',
        reason: body.items[0]?.reason ?? 'DEFECTIVE',
        status: 'REQUESTED',
        policy: { windowDays: 7, resolution: body.resolution } as never,
      },
    })
    await this.prisma.returnItem.createMany({ data: mapped.map((m) => ({ ...m, returnRequestId: created.id })) })
    await this.prisma.auditLog
      .create({
        data: {
          actorId: user.id,
          action: 'return.requested',
          entity: 'ReturnRequest',
          entityId: created.id,
          meta: { orderId: order.id, items: mapped.length } as never,
        },
      })
      .catch(() => undefined)
    return this.present(created.id)
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('role') role?: string) {
    const where =
      role === 'seller' && (user.role === 'SELLER' || user.role === 'STORE_STAFF' || user.role === 'ADMIN')
        ? { order: { store: { seller: { userId: user.id } } } }
        : role === 'admin' && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
          ? {}
          : { userId: user.id }
    const rows = await this.prisma.returnRequest.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return Promise.all(rows.map((r) => this.present(r.id)))
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('Return not found')
    if (row.userId !== user.id && !user.role.includes('ADMIN') && user.role !== 'SELLER' && user.role !== 'STORE_STAFF') {
      throw Errors.forbidden('Not your return')
    }
    return this.present(id)
  }

  @Post(':id/:action')
  @Roles('SELLER', 'STORE_STAFF', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  async action(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body(new ZodValidationPipe(returnActionSchema)) body: { note?: string },
  ) {
    const allowed = TRANSITIONS[action]
    if (!allowed) throw Errors.badRequest(`Unknown action ${action}`)
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true, payment: true } } },
    })
    if (!row) throw Errors.notFound('Return not found')
    if (!allowed.includes(row.status)) throw Errors.badRequest(`Cannot ${action} from ${row.status}`)
    const returnItems = await this.prisma.returnItem.findMany({ where: { returnRequestId: id } })

    const next = NEXT[action]
    const data: Record<string, unknown> = { status: next }
    if (action === 'Schedule') data['pickupDate'] = new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (action === 'Receive') data['receivedAt'] = new Date()
    if (action === 'Inspect') data['inspectionNotes'] = body.note ?? 'Inspected at store'

    if (action === 'Refund' && row.order.payment) {
      const amount = returnItems.reduce((sum: number, it: { orderItemId: string; quantity: number }) => {
        const oi = row.order.items.find((x: { id: string }) => x.id === it.orderItemId)
        return sum + (oi ? Number(oi.unitPrice) * it.quantity : 0)
      }, 0)
      await this.prisma.refund.create({
        data: { paymentId: row.order.payment.id, amount, reason: row.reason, status: 'PENDING' },
      })
    }
    if (action === 'Replace') {
      await this.prisma.replacementOrder
        .create({ data: { returnRequestId: row.id, originalOrderId: row.orderId, status: 'CREATED' } })
        .catch(() => undefined)
    }

    await this.prisma.returnRequest.update({ where: { id }, data: data as never })
    await this.prisma.auditLog
      .create({
        data: {
          actorId: user.id,
          action: `return.${action.toLowerCase()}`,
          entity: 'ReturnRequest',
          entityId: id,
          meta: { from: row.status, to: next, note: body.note } as never,
        },
      })
      .catch(() => undefined)
    return this.present(id)
  }

  private async present(id: string) {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true, payment: true } } },
    })
    if (!r) throw Errors.notFound('Return not found')
    const returnItems = await this.prisma.returnItem.findMany({ where: { returnRequestId: id } })
    const items = returnItems.map((it) => {
      const oi = r.order.items.find((x) => x.id === it.orderItemId)
      return {
        id: it.id,
        productId: oi?.productId ?? '',
        name: oi?.name ?? 'Item',
        qty: it.quantity,
        unitPrice: oi ? Number(oi.unitPrice) : 0,
        reason: it.reason,
      }
    })
    let refund: { id: string; status: string; amount: number } | null = null
    if (r.order.payment) {
      const rf = await this.prisma.refund.findFirst({
        where: { paymentId: r.order.payment.id },
        orderBy: { createdAt: 'desc' },
      })
      if (rf) refund = { id: rf.id, status: rf.status, amount: Number(rf.amount) }
    }
    return {
      id: r.id,
      number: `RET-${r.id.slice(-6).toUpperCase()}`,
      orderId: r.orderId,
      orderNumber: r.order.number,
      status: r.status,
      resolution: r.type === 'REPLACEMENT' ? 'REPLACEMENT' : 'REFUND',
      reason: r.reason,
      pickupAddress: r.order.addressSnap as never,
      refund,
      items,
      events: [{ id: r.id, status: r.status, note: r.inspectionNotes, createdAt: r.createdAt.toISOString() }],
      createdAt: r.createdAt.toISOString(),
    }
  }
}

@Module({ controllers: [ReturnsController] })
export class ReturnsModule {}
