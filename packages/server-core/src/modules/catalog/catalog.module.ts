import { Controller, Get, Module } from '@nestjs/common'
import { PrismaService } from '../../common/core.module'
import { Public } from '../../common/guards'
/**
 * Catalog — the single public, persisted source of truth for customer
 * discovery. Stores, products, prices and live availability all come from
 * database records; nothing here is hard-coded. The storefront renders this
 * endpoint (plus the search API) and never a static catalog.
 *
 * Only published/active data is returned:
 *  - products must be active
 *  - listings come from real inventory rows (available = quantity - reserved)
 *  - store open/close state is the persisted `open` flag
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async catalog() {
    const [categories, stores, products, inventory, storeReviews, productReviews] = await Promise.all([
      this.prisma.category.findMany({
        where: { products: { some: { active: true } } },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.store.findMany({
        include: {
          seller: { select: { verified: true, rating: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { active: true },
        include: {
          brand: { select: { name: true } },
          category: { select: { slug: true, name: true } },
          price: true,
          images: { orderBy: { position: 'asc' }, take: 4 },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inventory.findMany({
        select: {
          storeId: true,
          productId: true,
          quantity: true,
          reservedQuantity: true,
          availableQuantity: true,
          price: true,
          status: true,
          reserveEnabled: true,
          lastUpdatedAt: true,
        },
      }),
      this.prisma.review.findMany({
        where: { kind: 'STORE', storeId: { not: null } },
        select: { id: true, storeId: true, rating: true, text: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.review.findMany({
        where: { kind: 'PRODUCT', productId: { not: null } },
        select: { id: true, productId: true, rating: true, text: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc'},
        take: 200,
      }),
    ])

    const storeById = new Map(stores.map((s) => [s.id, s]))

    return {
      generatedAt: new Date().toISOString(),
      categories: categories.map((c) => ({
        id: c.slug,
        name: c.name,
        emoji: c.emoji,
        productCount: c._count.products,
      })),
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        blurb: s.blurb,
        rating: s.seller?.rating ?? s.rating,
        reviews: s.reviewCount,
        lat: s.lat,
        lng: s.lng,
        area: s.area,
        address: s.address,
        city: s.city,
        pincode: s.pincode,
        phone: s.phone,
        open: s.open,
        hours: s.hours,
        opensAt: s.opensAt,
        verified: s.verified,
        pickup: s.pickupEnabled,
        localDelivery: s.localDelivery,
        localDeliveryKm: s.localDeliveryKm,
        prepMins: s.prepMins,
        emoji: s.emoji,
        cover: s.coverUrl,
        followers: s.followers,
        since: s.createdAt.getFullYear(),
        localMaker: s.localMaker,
        health: {
          inventoryAccuracy: s.hInventoryAcc,
          orderAcceptance: s.hOrderAccept,
          reservationConfirm: s.hResvConfirm,
          prepTime: s.hPrepTime,
          cancellation: s.hCancellation,
          satisfaction: s.hSatisfaction,
        },
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand?.name ?? 'Local',
        category: p.category.slug,
        description: p.description,
        price: Number(p.price?.onlinePrice ?? p.price?.listPrice ?? 0),
        mrp: Number(p.price?.mrp ?? p.price?.listPrice ?? 0),
        rating: p.rating,
        ratingCount: p.ratingCount,
        // The product record itself is the "online" channel (catalog price
        // with lead time); local stores are the walk-in/delivery channels.
        online: p.price
          ? {
              price: Number(p.price.onlinePrice ?? p.price.listPrice),
              etaDaysMin: p.price.etaMin ?? 2,
              etaDaysMax: p.price.etaMax ?? 5,
            }
          : null,
        tags: p.tags,
        emoji: p.emoji,
        images: p.images.map((i) => i.url),
        cover: p.images[0]?.url,
        sellerId: p.ownerId,
      })),
      listings: inventory
        .filter((i) => storeById.has(i.storeId) && products.some((p) => p.id === i.productId))
        .map((i) => ({
          productId: i.productId,
          storeId: i.storeId,
          price: Number(i.price),
          stock: i.availableQuantity,
          quantity: i.quantity,
          status: i.status,
          reserveable: i.reserveEnabled,
          updatedMinsAgo: Math.max(0, Math.floor((Date.now() - i.lastUpdatedAt.getTime()) / 60000)),
        })),
      reviews: {
        store: storeReviews
          .filter((r) => r.storeId && storeById.has(r.storeId))
          .map((r) => ({
            id: r.id,
            storeId: r.storeId as string,
            author: r.user?.name ?? 'Neighbour',
            rating: r.rating,
            text: r.text ?? '',
            when: new Date(r.createdAt).toISOString(),
          })),
        product: productReviews
          .filter((r) => r.productId && products.some((p) => p.id === r.productId))
          .map((r) => ({
            id: r.id,
            productId: r.productId as string,
            author: r.user?.name ?? 'Neighbour',
            rating: r.rating,
            text: r.text ?? '',
            when: new Date(r.createdAt).toISOString(),
          })),
      },
    }
  }
}

@Module({ controllers: [CatalogController] })
export class CatalogModule {}
