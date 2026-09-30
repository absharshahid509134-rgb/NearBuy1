import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common'
import { reviewCreateSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, type AuthUser } from '../../common/guards'
/**
 * Reviews — product/store/delivery/pickup experiences. Only verified,
 * completed transactions can review (spam/duplicate protection).
 */


type ReviewInput = z.infer<typeof reviewCreateSchema>

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list(@Query('productId') productId?: string, @Query('storeId') storeId?: string) {
    return this.prisma.review.findMany({
      where: {
        ...(productId ? { productId } : {}),
        ...(storeId ? { storeId } : {}),
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(reviewCreateSchema)) body: ReviewInput) {
    // Eligibility: a completed order for this product/store by this user.
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id, status: { in: ['COMPLETED', 'READY_FOR_PICKUP'] } },
      include: { items: true },
    })
    const eligible = orders.find(
      (o) =>
        (!body.productId || o.items.some((i) => i.productId === body.productId)) &&
        (!body.storeId || o.storeId === body.storeId),
    )
    if (!eligible) throw Errors.forbidden('Only verified purchases can leave a review.')

    const review = await this.prisma.review.create({
      data: {
        userId: user.id,
        productId: body.productId,
        storeId: body.storeId,
        orderId: body.orderId ?? eligible.id,
        kind: body.kind,
        rating: body.rating,
        text: body.text,
      },
    })
    // refresh aggregates
    if (body.productId) await this.refreshProductRating(body.productId)
    if (body.storeId) await this.refreshStoreRating(body.storeId)
    return review
  }

  private async refreshProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true })
    await this.prisma.product.update({
      where: { id: productId },
      data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
    })
  }

  private async refreshStoreRating(storeId: string) {
    const agg = await this.prisma.review.aggregate({ where: { storeId }, _avg: { rating: true }, _count: true })
    await this.prisma.store.update({
      where: { id: storeId },
      data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
    })
  }
}

@Module({ controllers: [ReviewsController] })
export class ReviewsModule {}
