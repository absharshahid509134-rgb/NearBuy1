import { Body, Controller, Get, Module, Post } from '@nestjs/common'
import { notificationReadSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { ZodValidationPipe } from '../../common/errors'
import { CurrentUser, type AuthUser } from '../../common/guards'
/**
 * Notifications — in-app inbox + read state. Outbound channels are queued via
 * the notification bus outbox (email/SMS/push/WhatsApp workers).
 */


type ReadInput = z.infer<typeof notificationReadSchema>

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id, channel: 'IN_APP' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId: user.id, channel: 'IN_APP', readAt: null } }),
    ])
    return { items, unread }
  }

  @Post('read')
  async read(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(notificationReadSchema)) body: ReadInput) {
    await this.prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: { readAt: new Date() },
    })
    return { ok: true }
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
