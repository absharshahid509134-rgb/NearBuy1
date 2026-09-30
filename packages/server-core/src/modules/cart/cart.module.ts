import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common'
import { cartAddSchema, cartUpdateSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, type AuthUser } from '../../common/guards'
import { INJECTION } from '../../common/core.module'
import { Inject } from '@nestjs/common'
import type { MapProvider } from '@nearbuy/maps'
import { CUSTOMER_HOME } from '../stores/stores.module'
import type { AnalyticsProvider } from '@nearbuy/analytics'
/**
 * Cart — multi-store carts. One cart can hold several stores + online lines;
 * checkout groups by seller and creates per-store orders with own fulfillment.
 */

type CartAddInput = z.infer<typeof cartAddSchema>
type CartUpdateInput = z.infer<typeof cartUpdateSchema>

@Controller('cart')
export class CartController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.MAP) private readonly maps: MapProvider,
    @Inject(INJECTION.ANALYTICS) private readonly analytics: AnalyticsProvider,
  ) {}

  private async getCart(userId: string) {
    return (
      (await this.prisma.cart.findUnique({ where: { userId }, include: { items: true } })) ??
      (await this.prisma.cart.create({ data: { userId } }))
    )
  }

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const cart = await this.getCart(user.id)
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
    })
    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: { price: true, brand: true },
        })
        let unitPrice = product?.price ? Number(product.price.onlinePrice) : 0
        let storeName: string | null = null
        let distanceKm: number | null = null
        let available = true
        if (item.storeId) {
          const inv = await this.prisma.inventory.findFirst({
            where: { storeId: item.storeId, productId: item.productId },
            include: { store: true },
          })
          if (inv) {
            unitPrice = Number(inv.price)
            storeName = inv.store.name
            distanceKm = round1(this.maps.distanceKm(CUSTOMER_HOME, inv.store))
            available = inv.availableQuantity >= item.qty
          } else {
            available = false
          }
        }
        return {
          id: item.id,
          productId: item.productId,
          slug: product?.slug,
          name: product?.name ?? 'Product',
          emoji: product?.emoji ?? '🛍️',
          brand: product?.brand?.name,
          qty: item.qty,
          storeId: item.storeId,
          storeName,
          distanceKm,
          unitPrice,
          available,
          lineTotal: unitPrice * item.qty,
        }
      }),
    )
    const subtotal = enriched.reduce((s, i) => s + i.lineTotal, 0)
    const stores = [...new Set(enriched.map((i) => i.storeId ?? 'online'))]
    return {
      id: cart.id,
      couponCode: cart.couponCode,
      items: enriched,
      subtotal,
      storeCount: stores.length,
      // Basket optimizer preview — never silently chooses for the customer.
      optimizer: {
        oneStore: Math.round(subtotal * 1.08),
        twoStores: Math.round(subtotal * 0.985),
        online: Math.round(subtotal * 0.94),
        criteria: ['Lowest Cost', 'Fastest', 'Fewest Stops', 'Most Convenient'],
      },
    }
  }

  @Post('items')
  async add(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(cartAddSchema)) body: CartAddInput) {
    const product = await this.prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) throw Errors.notFound('Product not found.')
    const cart = await this.getCart(user.id)
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: body.productId, variantId: body.variantId ?? null, storeId: body.storeId ?? null },
    })
    const item = existing
      ? await this.prisma.cartItem.update({ where: { id: existing.id }, data: { qty: { increment: body.qty } } })
      : await this.prisma.cartItem.create({
          data: { cartId: cart.id, productId: body.productId, variantId: body.variantId, storeId: body.storeId, qty: body.qty },
        })
    await this.prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } })
    this.analytics.track({ name: 'add_to_cart', userId: user.id, props: { productId: body.productId }, at: Date.now() })
    return item
  }

  @Patch('items/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(cartUpdateSchema)) body: CartUpdateInput) {
    const cart = await this.getCart(user.id)
    const item = await this.prisma.cartItem.findUnique({ where: { id } })
    if (!item || item.cartId !== cart.id) throw Errors.notFound('Cart item not found.')
    if (body.qty === 0) {
      await this.prisma.cartItem.delete({ where: { id } })
      return { ok: true, removed: true }
    }
    return this.prisma.cartItem.update({ where: { id }, data: { qty: body.qty } })
  }

  @Delete('items/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const cart = await this.getCart(user.id)
    const item = await this.prisma.cartItem.findUnique({ where: { id } })
    if (!item || item.cartId !== cart.id) throw Errors.notFound('Cart item not found.')
    await this.prisma.cartItem.delete({ where: { id } })
    return { ok: true }
  }

  @Delete()
  async clear(@CurrentUser() user: AuthUser) {
    const cart = await this.getCart(user.id)
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    return { ok: true }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

@Module({ controllers: [CartController] })
export class CartModule {}
