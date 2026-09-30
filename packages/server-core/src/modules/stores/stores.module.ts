import { Controller, Get, Inject, Module, Param, Query } from '@nestjs/common'
import type { MapProvider } from '@nearbuy/maps'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Errors } from '../../common/errors'
import { Public } from '../../common/guards'
/**
 * Stores — public discovery, nearby search (MapProvider), store pages, follow.
 */

export const CUSTOMER_HOME = { lat: 28.5921, lng: 77.046, label: 'Dwarka Sector 22' }

@Controller('stores')
export class StoresController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.MAP) private readonly maps: MapProvider,
  ) {}

  @Public()
  @Get()
  async list(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('category') category?: string,
    @Query('openNow') openNow?: string,
    @Query('limit') limit = '30',
  ) {
    const origin = { lat: parseFloat(lat ?? '') || CUSTOMER_HOME.lat, lng: parseFloat(lng ?? '') || CUSTOMER_HOME.lng }
    const stores = await this.prisma.store.findMany({
      where: { ...(category ? { category } : {}), ...(openNow === 'true' ? { open: true } : {}) },
      include: { seller: { select: { verified: true, rating: true } } },
      take: Math.min(parseInt(limit, 10) || 30, 100),
    })
    return stores
      .map((s) => ({ ...s, distanceKm: round1(this.maps.distanceKm(origin, s)) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }

  @Public()
  @Get('nearby')
  async nearby(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm = '5',
  ) {
    const origin = { lat: parseFloat(lat ?? '') || CUSTOMER_HOME.lat, lng: parseFloat(lng ?? '') || CUSTOMER_HOME.lng }
    const radius = parseFloat(radiusKm) || 5
    const stores = await this.prisma.store.findMany({
      where: { open: true },
      include: { inventory: { where: { availableQuantity: { gt: 0 } }, select: { productId: true } } },
    })
    return stores
      .map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        area: s.area,
        emoji: s.emoji,
        verified: s.verified,
        pickupEnabled: s.pickupEnabled,
        localDelivery: s.localDelivery,
        rating: s.rating,
        hours: s.hours,
        inStockProducts: s.inventory.length,
        distanceKm: round1(this.maps.distanceKm(origin, s)),
        travelMins: this.maps.estimateTravelMins(origin, s, 'drive'),
      }))
      .filter((s) => s.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }

  @Public()
  @Get(':slug')
  async get(@Param('slug') slug: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        seller: { select: { verified: true, rating: true, legalName: true } },
        reviews: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!store) throw Errors.notFound('Store not found.')
    const origin = { lat: parseFloat(lat ?? '') || CUSTOMER_HOME.lat, lng: parseFloat(lng ?? '') || CUSTOMER_HOME.lng }
    return {
      ...store,
      distanceKm: round1(this.maps.distanceKm(origin, store)),
      // Health metrics are shown with context — never collapsed into one public score.
      health: {
        inventoryAccuracy: store.hInventoryAcc,
        orderAcceptance: store.hOrderAccept,
        reservationConfirm: store.hResvConfirm,
        prepTime: store.hPrepTime,
        cancellation: store.hCancellation,
        satisfaction: store.hSatisfaction,
      },
    }
  }

  @Public()
  @Get(':slug/products')
  async products(@Param('slug') slug: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } })
    if (!store) throw Errors.notFound('Store not found.')
    const origin = { lat: parseFloat(lat ?? '') || CUSTOMER_HOME.lat, lng: parseFloat(lng ?? '') || CUSTOMER_HOME.lng }
    const inv = await this.prisma.inventory.findMany({
      where: { storeId: store.id, availableQuantity: { gt: 0 } },
      include: { product: { include: { brand: true, category: true, images: true, price: true } } },
      orderBy: { lastUpdatedAt: 'desc' },
    })
    const distanceKm = round1(this.maps.distanceKm(origin, store))
    return inv.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      slug: i.product.slug,
      emoji: i.product.emoji,
      brand: i.product.brand?.name,
      category: i.product.category.name,
      price: Number(i.price),
      stock: i.availableQuantity,
      confidence: confidence(i.lastUpdatedAt),
      updatedMinsAgo: minsAgo(i.lastUpdatedAt),
      storeId: store.id,
      storeName: store.name,
      distanceKm,
      pickup: store.pickupEnabled,
      localDelivery: store.localDelivery,
      prepMins: store.prepMins,
    }))
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function minsAgo(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 60000)
}
export function confidence(lastUpdatedAt: Date): 'FRESH' | 'STALE' | 'UNKNOWN' {
  const m = minsAgo(lastUpdatedAt)
  return m <= 60 ? 'FRESH' : m <= 480 ? 'STALE' : 'UNKNOWN'
}

@Module({ controllers: [StoresController] })
export class StoresModule {}
