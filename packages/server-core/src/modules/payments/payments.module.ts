import { Body, Controller, Get, Inject, Module, Param, Post, Req } from '@nestjs/common'
import { paymentIntentSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import type { PaymentProvider } from '@nearbuy/payments'
import type { Request } from 'express'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
/**
 * Payments — provider-agnostic intents/capture/refunds. Payment status is kept
 * strictly separate from order/fulfillment/delivery status.
 */


type IntentInput = z.infer<typeof paymentIntentSchema>

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.PAYMENTS) private readonly provider: PaymentProvider,
  ) {}

  @Post('intents')
  async intent(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(paymentIntentSchema)) body: IntentInput) {
    const order = await this.prisma.order.findUnique({ where: { id: body.orderId }, include: { payment: true } })
    if (!order || order.userId !== user.id) throw Errors.notFound('Order not found.')
    if (order.payment) throw Errors.conflict('Payment already exists for this order.', 'PAYMENT_EXISTS')
    const intent = await this.provider.createIntent({ id: order.id, number: order.number }, Number(order.total), body.method)
    const status = body.method === 'COD' || body.method === 'PAY_AT_STORE' ? 'PENDING' : 'PAID'
    return this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId: user.id,
        method: body.method,
        status,
        amount: order.total,
        providerRef: intent.providerRef,
        providerMeta: intent.meta as never,
      },
    })
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { refunds: true } })
    if (!payment) throw Errors.notFound('Payment not found.')
    if (payment.userId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw Errors.forbidden()
    return payment
  }

  /** Provider webhook (signature-verified; idempotent by providerRef). */
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT') // provider calls carry service credentials in production
  @Post('webhook')
  async webhook(@Req() req: Request & { body: unknown }, @Body() body: { providerRef?: string; status?: string }) {
    const signature = req.header('x-provider-signature') ?? undefined
    const raw = JSON.stringify(req.body)
    if (!this.provider.verifyWebhook(raw, signature)) throw Errors.unauthorized('Invalid webhook signature.')
    if (!body?.providerRef) throw Errors.badRequest('providerRef required.')
    await this.prisma.payment.updateMany({
      where: { providerRef: body.providerRef },
      data: { status: body.status === 'failed' ? 'FAILED' : 'PAID' },
    })
    return { received: true }
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT')
  @Post(':id/refund')
  async refund(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() body: { amount?: number; reason?: string }) {
    const payment = await this.prisma.payment.findUnique({ where: { id } })
    if (!payment) throw Errors.notFound('Payment not found.')
    const amount = body.amount ?? Number(payment.amount)
    const result = await this.provider.refund(payment.providerRef ?? '', amount)
    const [refund] = await this.prisma.$transaction([
      this.prisma.refund.create({
        data: { paymentId: payment.id, amount, reason: body.reason, status: result.ok ? 'COMPLETED' : 'PENDING' },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: amount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      }),
      this.prisma.auditLog.create({
        data: { actorId: admin.id, action: 'payment_refunded', entity: 'Payment', entityId: payment.id, meta: { amount } },
      }),
    ])
    return refund
  }
}

@Module({ controllers: [PaymentsController] })
export class PaymentsModule {}
