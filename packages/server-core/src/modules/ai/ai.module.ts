import { Body, Controller, Inject, Module, Post } from '@nestjs/common'
import {
  askNearAI,
  askSellerAI,
  type AiTools,
  type LlmProvider,
  type SellerAiTools,
} from '@nearbuy/ai'
import { aiChatSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { INJECTION, PrismaService } from '../../common/core.module'
import { ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/guards'
import { SearchService, SearchModule } from '../search/search.module'
import { CUSTOMER_HOME } from '../stores/stores.module'
/**
 * AI platform — Frontend → AI API → AI Service (@nearbuy/ai) → tools/search/
 * catalog → LLM provider. NearAI answers ONLY from verified price/inventory/
 * distance/hours data; it never fabricates availability.
 */


type ChatInput = z.infer<typeof aiChatSchema>

@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    @Inject(INJECTION.LLM) private readonly llm: LlmProvider,
  ) {}

  /** NearAI — customer shopping assistant. */
  @Public()
  @Post('nearai')
  async nearai(@Body(new ZodValidationPipe(aiChatSchema)) body: ChatInput, @CurrentUser() user?: AuthUser) {
    const origin = { lat: body.lat ?? CUSTOMER_HOME.lat, lng: body.lng ?? CUSTOMER_HOME.lng }
    const tools: AiTools = {
      searchProducts: async (q) => {
        const result = await this.search.search(
          {
            q,
            lat: origin.lat,
            lng: origin.lng,
            radiusKm: 5,
            sort: 'recommended',
            limit: 6,
          },
          user?.id,
        )
        return result.hits.map((h) => ({
          productId: h.productId,
          name: h.name,
          brand: h.brand,
          category: h.category,
          tags: [],
          price: h.price,
          distanceKm: h.closestKm ?? undefined,
          rating: h.rating,
          availableNow: h.unitsNearby > 0,
          pickupToday: h.pickupToday,
          openNow: h.openNow,
        }))
      },
      storesOpenNearby: async () => {
        const stores = await this.prisma.store.findMany({ where: { open: true } })
        return stores
          .map((s) => ({
            id: s.id,
            name: s.name,
            area: s.area,
            distanceKm: dist(origin.lat, origin.lng, s.lat, s.lng),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
      },
      productSummary: async (id) => {
        const p = await this.prisma.product.findUnique({
          where: { id },
          include: { price: true, inventory: { where: { availableQuantity: { gt: 0 } }, include: { store: true } } },
        })
        if (!p) return null
        const closest = p.inventory.length
          ? Math.min(...p.inventory.map((i) => dist(origin.lat, origin.lng, i.store.lat, i.store.lng)))
          : null
        const openWithPickup = p.inventory.filter((i) => i.store.open && i.store.pickupEnabled)
        return {
          name: p.name,
          price: p.inventory.length ? Math.min(...p.inventory.map((i) => Number(i.price))) : Number(p.price?.onlinePrice ?? 0),
          stores: p.inventory.length,
          units: p.inventory.reduce((s, i) => s + i.availableQuantity, 0),
          closestKm: closest,
          fastestMins: openWithPickup.length
            ? Math.round(
                Math.min(...openWithPickup.map((i) => i.store.prepMins + dist(origin.lat, origin.lng, i.store.lat, i.store.lng) * 6)),
              )
            : null,
        }
      },
    }
    return askNearAI(body.message, tools, this.llm)
  }

  /** Product comparison — grounded option table. */
  @Public()
  @Post('compare')
  async compare(@Body(new ZodValidationPipe(aiChatSchema)) body: ChatInput, @CurrentUser() user?: AuthUser) {
    const result = await this.search.search(
      { q: body.message, lat: body.lat, lng: body.lng, radiusKm: 6, sort: 'cheapest', limit: 4 },
      user?.id,
    )
    return {
      criteria: ['PRICE', 'DISTANCE', 'TIME'],
      options: result.hits.map((h) => ({
        label: h.name,
        productId: h.productId,
        price: h.price,
        distance: h.closestKm,
        time: h.pickupToday ? `Pickup ~${h.fastestMins} min` : `${h.storesNearby > 0 ? 'Local' : 'Online'} option`,
      })),
      sortedBy: 'price — criteria always visible',
    }
  }

  /** Seller assistant — natural-language store operations. */
  @Roles('SELLER', 'STORE_STAFF', 'ADMIN', 'SUPER_ADMIN')
  @Post('seller')
  async seller(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(aiChatSchema)) body: ChatInput) {
    const store = await this.prisma.store.findFirst({
      where: { seller: { userId: user.id } },
      include: { inventory: { include: { product: true } } },
    })
    if (!store) return { text: 'Create a store first from Become a Seller.', productIds: [], storeIds: [], chips: [] }

    const tools: SellerAiTools = {
      addStock: async (item, qty) => {
        const product = await this.prisma.product.findFirst({
          where: { name: { contains: item, mode: 'insensitive' } },
          include: { price: true },
        })
        if (!product) return `No catalog product matches “${item}”. Add it from Products first.`
        const inv = await this.prisma.inventory.findFirst({ where: { storeId: store.id, productId: product.id } })
        if (inv) {
          await this.prisma.inventory.update({
            where: { id: inv.id },
            data: {
              quantity: { increment: qty },
              availableQuantity: { increment: qty },
              lastUpdatedAt: new Date(),
              updatedBy: user.id,
            },
          })
        } else {
          await this.prisma.inventory.create({
            data: {
              storeId: store.id,
              productId: product.id,
              quantity: qty,
              availableQuantity: qty,
              price: product.price?.listPrice ?? 0,
            },
          })
        }
        const record = inv ?? (await this.prisma.inventory.findFirstOrThrow({ where: { storeId: store.id, productId: product.id } }))
        await this.prisma.inventoryAudit.create({
          data: { inventoryId: record.id, change: qty, reason: 'AI_ADD', actorId: user.id },
        })
        return `Done — added ${qty} × ${product.name} to your inventory.`
      },
      lowStock: async () =>
        store.inventory
          .filter((i) => i.availableQuantity <= 4)
          .map((i) => ({ id: i.productId, name: i.product.name, stock: i.availableQuantity })),
      topSellers: async () => {
        const items = await this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: { order: { storeId: store.id } },
          _sum: { qty: true },
          orderBy: { _sum: { qty: 'desc' } },
          take: 5,
        })
        const out = []
        for (const i of items) {
          const p = await this.prisma.product.findUnique({ where: { id: i.productId } })
          if (p) out.push({ id: p.id, name: p.name, sold: i._sum.qty ?? 0 })
        }
        return out
      },
      createOffer: async (kind) => {
        await this.prisma.promotion.create({
          data: {
            storeId: store.id,
            title: `${kind === 'WEEKEND' ? 'Weekend 10% Off' : 'New Offer'}`,
            kind: 'FLASH',
            detail: 'Target: nearby + returning customers within 3 km.',
            savings: 100,
            endsAt: new Date(Date.now() + 3 * 24 * 3600e3),
          },
        })
        return 'Created a weekend offer for nearby + returning customers. It shows up in Deals.'
      },
      pickupQueue: async () => {
        const res = await this.prisma.reservation.findMany({
          where: { storeId: store.id, status: { in: ['CONFIRMED', 'PACKING', 'READY_FOR_PICKUP'] } },
        })
        return res.map((r) => ({ code: r.code, window: r.pickupWindow, status: r.status }))
      },
    }
    return askSellerAI(body.message, tools)
  }
}

function dist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10
}

@Module({ controllers: [AiController], imports: [SearchModule] })
export class AiModule {}
