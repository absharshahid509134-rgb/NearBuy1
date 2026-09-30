import { Body, Controller, Get, Module, Param, Patch, Post } from '@nestjs/common'
import { sellerRegisterSchema, updateStoreSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/guards'
/**
 * Sellers — onboarding (seller + first store), profile, verification documents.
 */

type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>
type StoreUpdateInput = z.infer<typeof updateStoreSchema>

@Controller('sellers')
export class SellersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Complete onboarding for an account already registered as SELLER. */
  @Roles('SELLER')
  @Post('register')
  async register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(sellerRegisterSchema)) body: SellerRegisterInput,
  ) {
    // RolesGuard intentionally lets SUPER_ADMIN bypass @Roles, but onboarding
    // must never attach a seller profile to an administrative account.
    if (user.role !== 'SELLER') throw Errors.forbidden('Only seller accounts can set up a store.')
    const existing = await this.prisma.seller.findUnique({ where: { userId: user.id } })
    if (existing) throw Errors.conflict('You are already a seller.', 'ALREADY_SELLER')

    const slugBase = body.store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`

    const [seller] = await this.prisma.$transaction([
      this.prisma.seller.create({
        data: {
          userId: user.id,
          legalName: body.legalName,
          gstin: body.gstin,
          stores: {
            create: {
              name: body.store.name,
              slug,
              category: body.store.category,
              blurb: body.store.blurb,
              lat: body.store.lat,
              lng: body.store.lng,
              area: body.store.area,
              address: body.store.address,
              pincode: body.store.pincode,
              hours: body.store.hours,
              opensAt: body.store.opensAt,
              emoji: body.store.emoji,
            },
          },
        },
        include: { stores: true },
      }),
      this.prisma.auditLog.create({
        data: { actorId: user.id, action: 'seller_registered', entity: 'Seller' },
      }),
    ])
    return seller
  }

  @Roles('SELLER')
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    if (user.role !== 'SELLER') throw Errors.forbidden('Only seller accounts can open Seller Hub.')
    const seller = await this.prisma.seller.findUnique({
      where: { userId: user.id },
      include: { stores: { include: { inventory: true } } },
    })
    if (!seller) throw Errors.notFound('Seller profile not found.')
    return seller
  }

  @Public()
  @Get(':id')
  async get(@Param('id') id: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id }, include: { stores: true } })
    if (!seller) throw Errors.notFound('Seller not found.')
    return seller
  }

  @Patch('stores/:storeId')
  async updateStore(
    @CurrentUser() user: AuthUser,
    @Param('storeId') storeId: string,
    @Body(new ZodValidationPipe(updateStoreSchema)) body: StoreUpdateInput,
  ) {
    await this.assertStoreOwner(user, storeId)
    return this.prisma.store.update({ where: { id: storeId }, data: body })
  }

  /** Seller verification document upload stub — validates then records. */
  @Post('stores/:storeId/documents')
  async uploadDoc(@CurrentUser() user: AuthUser, @Param('storeId') storeId: string, @Body() body: { url: string; kind?: string }) {
    await this.assertStoreOwner(user, storeId)
    if (!body?.url || typeof body.url !== 'string') throw Errors.badRequest('Document URL required.')
    if (body.url.length > 500) throw Errors.badRequest('Invalid document reference.')
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'seller_document_uploaded', entity: 'Store', entityId: storeId, meta: { kind: body.kind ?? 'ID_PROOF' } },
    })
    return { ok: true, status: 'PENDING_VERIFICATION' }
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post('admin/:sellerId/verify')
  async verify(@CurrentUser() admin: AuthUser, @Param('sellerId') sellerId: string) {
    const seller = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { verified: true, verifiedAt: new Date() },
    })
    await this.prisma.store.updateMany({ where: { sellerId }, data: { verified: true } })
    await this.prisma.auditLog.create({ data: { actorId: admin.id, action: 'seller_verified', entity: 'Seller', entityId: sellerId } })
    return seller
  }

  private async assertStoreOwner(user: AuthUser, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, include: { seller: true } })
    if (!store) throw Errors.notFound('Store not found.')
    const isOwner = store.seller.userId === user.id
    const isStaff = await this.prisma.storeStaff.findFirst({ where: { storeId, userId: user.id } })
    if (!isOwner && !isStaff && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw Errors.forbidden()
    return store
  }
}

@Module({ controllers: [SellersController] })
export class SellersModule {}
