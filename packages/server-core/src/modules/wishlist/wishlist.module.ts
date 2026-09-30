import { Body, Controller, Delete, Get, Module, Param, Post } from '@nestjs/common'
import { wishlistAddSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, type AuthUser } from '../../common/guards'
/**
 * Wishlist — saved items with smart signals (price drop / nearby stock).
 */


type AddInput = z.infer<typeof wishlistAddSchema>

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const wishlist =
      (await this.prisma.wishlist.findUnique({ where: { userId: user.id }, include: { items: { include: { product: { include: { price: true } } } } } })) ??
      (await this.prisma.wishlist.create({
        data: { userId: user.id },
        include: { items: { include: { product: { include: { price: true } } } } },
      }))

    const items = await Promise.all(
      (wishlist.items ?? []).map(async (item) => {
        const listings = await this.prisma.inventory.findMany({
          where: { productId: item.productId, availableQuantity: { gt: 0 } },
          include: { store: true },
        })
        const best = listings.reduce<number | null>(
          (min, l) => (min == null || Number(l.price) < min ? Number(l.price) : min),
          null,
        )
        const closestKm = listings.length
          ? Math.min(...listings.map((l) => distanceApprox(l.store.lat, l.store.lng)))
          : null
        return {
          id: item.id,
          productId: item.productId,
          slug: item.product.slug,
          name: item.product.name,
          emoji: item.product.emoji,
          mrp: item.product.price ? Number(item.product.price.mrp) : null,
          bestPrice: best,
          storesNearby: listings.length,
          closestKm,
          // smart wishlist annotations
          signals: [
            best != null && item.product.price && best < Number(item.product.price.mrp)
              ? `↓ Price changed · now ₹${best}`
              : null,
            closestKm != null ? `📍 Available ${closestKm.toFixed(1)} km away` : null,
            listings.length ? `⚡ ${listings.length} stores have it today` : 'Notify me when nearby',
          ].filter(Boolean),
        }
      }),
    )
    return { items }
  }

  @Post('items')
  async add(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(wishlistAddSchema)) body: AddInput) {
    const product = await this.prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) throw Errors.notFound('Product not found.')
    const wishlist =
      (await this.prisma.wishlist.findUnique({ where: { userId: user.id } })) ??
      (await this.prisma.wishlist.create({
        data: { userId: user.id },
        include: { items: { include: { product: { include: { price: true } } } } },
      }))
    return this.prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId: body.productId } },
      update: {},
      create: { wishlistId: wishlist.id, productId: body.productId },
    })
  }

  @Delete('items/:productId')
  async remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({ where: { userId: user.id } })
    if (!wishlist) throw Errors.notFound('Wishlist not found.')
    await this.prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } })
    return { ok: true }
  }
}

function distanceApprox(lat: number, lng: number): number {
  // coarse local approximation for annotations (server uses MapProvider elsewhere)
  const dLat = lat - 28.5921
  const dLng = lng - 77.046
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111
}

@Module({ controllers: [WishlistController] })
export class WishlistModule {}
