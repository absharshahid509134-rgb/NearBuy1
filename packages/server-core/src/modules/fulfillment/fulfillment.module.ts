import { Controller, Get, Inject, Module, Query } from '@nestjs/common'
import type { MapProvider } from '@nearbuy/maps'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Public } from '../../common/guards'
import { buildFulfillmentOptions } from './engine'
import { CUSTOMER_HOME } from '../stores/stores.module'

@Controller('fulfillment')
export class FulfillmentController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.MAP) private readonly maps: MapProvider,
  ) {}

  /** Options for a product (and optionally a specific store) — the engine decides. */
  @Public()
  @Get('methods')
  async methods(
    @Query('productId') productId: string,
    @Query('storeId') storeId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    if (!productId) return { options: [] }
    const origin = { lat: parseFloat(lat ?? '') || CUSTOMER_HOME.lat, lng: parseFloat(lng ?? '') || CUSTOMER_HOME.lng }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { price: true },
    })
    if (!product) return { options: [] }

    const listing = await this.prisma.inventory.findFirst({
      where: { productId, ...(storeId ? { storeId } : {}), availableQuantity: { gt: 0 } },
      include: { store: true },
      orderBy: { availableQuantity: 'desc' },
    })

    const ctx = {
      store: listing
        ? {
            id: listing.store.id,
            name: listing.store.name,
            pickupEnabled: listing.store.pickupEnabled,
            localDelivery: listing.store.localDelivery,
            localDeliveryKm: listing.store.localDeliveryKm,
            prepMins: listing.store.prepMins,
            open: listing.store.open,
          }
        : null,
      online: product.price
        ? { price: Number(product.price.onlinePrice), etaMin: product.price.etaMin, etaMax: product.price.etaMax }
        : null,
      inStockLocal: listing?.availableQuantity ?? 0,
      distanceKm: listing ? round1(this.maps.distanceKm(origin, listing.store)) : 99,
      hasLocalListing: !!listing,
    }
    return { options: buildFulfillmentOptions(ctx, this.maps) }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

@Module({ controllers: [FulfillmentController] })
export class FulfillmentModule {}
