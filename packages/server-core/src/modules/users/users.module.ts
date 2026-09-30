import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common'
import { addressSchema, updateProfileSchema } from '@nearbuy/validation'
import type { Prisma } from '@nearbuy/database'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, type AuthUser } from '../../common/guards'
/**
 * Users — profile, addresses, privacy controls, account deletion & data export.
 * Location privacy: customers pick CURRENT/HOME/WORK/PINCODE/AREA/MAP — only the
 * minimum required location is used per request; nothing is tracked continuously.
 */

type AddressInput = z.infer<typeof addressSchema>
type ProfileInput = z.infer<typeof updateProfileSchema>

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { customerProfile: true, addresses: true, deliveryPartner: true },
    })
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      locale: row.locale,
      locationMode: row.locationMode,
      locationLabel: row.locationLabel,
      emailVerified: row.emailVerified,
      phoneVerified: row.phoneVerified,
      createdAt: row.createdAt,
      addresses: row.addresses,
      profile: row.customerProfile,
    }
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateProfileSchema)) body: ProfileInput) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        locale: body.locale,
        locationMode: body.locationMode,
        locationLabel: body.locationLabel,
        customerProfile: body.prefs ? { update: { prefs: body.prefs as Prisma.InputJsonValue } } : undefined,
      },
      select: { id: true, name: true, locale: true, locationMode: true, locationLabel: true },
    })
  }

  @Get('me/addresses')
  async addresses(@CurrentUser() user: AuthUser) {
    return this.prisma.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: 'desc' } })
  }

  @Post('me/addresses')
  async addAddress(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(addressSchema)) body: AddressInput) {
    if (body.isDefault) await this.prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } })
    return this.prisma.address.create({ data: { ...body, userId: user.id } })
  }

  @Delete('me/addresses/:id')
  async removeAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } })
    if (!addr || addr.userId !== user.id) throw Errors.notFound('Address not found.')
    await this.prisma.address.delete({ where: { id } })
    return { ok: true }
  }

  /** Data export — privacy requirement. */
  @Get('me/export')
  async export(@CurrentUser() user: AuthUser) {
    const [profile, addresses, orders, reservations, reviews, notifications] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, include: { customerProfile: true } }),
      this.prisma.address.findMany({ where: { userId: user.id } }),
      this.prisma.order.findMany({ where: { userId: user.id }, include: { items: true } }),
      this.prisma.reservation.findMany({ where: { userId: user.id }, include: { items: true } }),
      this.prisma.review.findMany({ where: { userId: user.id } }),
      this.prisma.notification.findMany({ where: { userId: user.id } }),
    ])
    return { exportedAt: new Date().toISOString(), profile, addresses, orders, reservations, reviews, notifications }
  }

  /** Account deletion — soft delete + PII scrub, auditable. */
  @Delete('me')
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'DELETED', email: null, phone: null, passwordHash: null, name: 'Deleted User' },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorId: user.id, action: 'account_deleted', entity: 'User', entityId: user.id } }),
    ])
    return { ok: true }
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
