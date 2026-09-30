import { Controller, Get, Inject, Injectable, Module, Post, Body, Query } from '@nestjs/common'
import { bareTerms, parseNaturalQuery, type SearchDoc, type SearchEngine } from '@nearbuy/search'
import { searchQuerySchema } from '@nearbuy/validation'
import type { z } from 'zod'
import type { MapProvider } from '@nearbuy/maps'
import { INJECTION, PrismaService } from '../../common/core.module'
import { Public, CurrentUser, type AuthUser } from '../../common/guards'
import { CUSTOMER_HOME, confidence } from '../stores/stores.module'
import type { AnalyticsProvider } from '@nearbuy/analytics'
import { ZodValidationPipe } from '../../common/errors'
/**
 * Search — dedicated search abstraction over catalog + local inventory.
 * Natural language → structured filters; results carry availability & distance.
 * Every query is recorded (anonymised aggregation) for Demand Radar.
 */

type SearchInput = z.infer<typeof searchQuerySchema>

export interface ProductHit {
  productId: string
  slug: string
  name: string
  brand?: string
  category: string
  emoji: string
  price: number
  mrp: number
  onlinePrice?: number
  rating: number
  storesNearby: number
  unitsNearby: number
  closestKm: number | null
  fastestMins: number | null
  openNow: boolean
  pickupToday: boolean
  bestStoreId?: string
  bestStoreName?: string
  confidence: 'FRESH' | 'STALE' | 'UNKNOWN'
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INJECTION.MAP) private readonly maps: MapProvider,
    @Inject(INJECTION.SEARCH) private readonly engine: SearchEngine,
    @Inject(INJECTION.ANALYTICS) private readonly analytics: AnalyticsProvider,
  ) {}

  /** Build the live corpus from inventory × products (search-friendly view). */
  async corpus(origin: { lat: number; lng: number }): Promise<SearchDoc[]> {
    const listings = await this.prisma.inventory.findMany({
      where: { availableQuantity: { gt: 0 } },
      include: {
        product: { include: { brand: true, price: true, category: true } },
        store: true,
      },
    })
    return listings.map((l) => ({
      productId: l.productId,
      storeId: l.storeId,
      name: l.product.name,
      brand: l.product.brand?.name,
      category: l.product.category?.name,
      tags: l.product.tags,
      price: Number(l.price),
      distanceKm: round1(this.maps.distanceKm(origin, l.store)),
      rating: l.product.rating,
      availableNow: l.availableQuantity > 0,
      pickupToday: l.store.open && l.store.pickupEnabled && l.availableQuantity > 0,
      openNow: l.store.open,
    }))
  }

  async search(input: SearchInput, userId?: string) {
    const parsed = parseNaturalQuery(input.q)
    // explicit query params override NL-parsed values
    const effective = {
      ...parsed,
      maxPrice: input.maxPrice ?? parsed.maxPrice,
      minPrice: input.minPrice ?? parsed.minPrice,
      maxDistanceKm: parsed.maxDistanceKm ?? input.radiusKm,
      minRating: input.minRating ?? parsed.minRating,
      brand: input.brand ?? parsed.brand,
      category: input.category ?? parsed.category,
      openNow: input.availableNow || input.openNow || parsed.openNow,
      availableToday: input.availableNow || parsed.availableToday,
    }
    const origin = {
      lat: input.lat ?? CUSTOMER_HOME.lat,
      lng: input.lng ?? CUSTOMER_HOME.lng,
    }
    const corpus = await this.corpus(origin)
    const docs = await this.engine.query(
      {
        parsed: effective,
        terms: bareTerms(parsed),
        sort: input.sort,
        limit: input.limit,
        radiusKm: input.radiusKm,
      },
      corpus,
    )

    // roll up per product (best/cheapest + closest listing)
    const byProduct = new Map<string, ProductHit>()
    for (const doc of docs) {
      const existing = byProduct.get(doc.productId)
      const fastestMins = doc.pickupToday ? Math.round(10 + (doc.distanceKm ?? 2) * 6) : null
      if (!existing) {
        byProduct.set(doc.productId, {
          productId: doc.productId,
          slug: '',
          name: doc.name,
          brand: doc.brand,
          category: doc.category ?? '',
          emoji: '🛍️',
          price: doc.price,
          mrp: doc.price,
          rating: doc.rating,
          storesNearby: 1,
          unitsNearby: 1,
          closestKm: doc.distanceKm ?? null,
          fastestMins,
          openNow: doc.openNow ?? false,
          pickupToday: doc.pickupToday,
          bestStoreId: doc.storeId,
          bestStoreName: undefined,
          confidence: 'FRESH',
        })
      } else {
        existing.storesNearby += 1
        existing.unitsNearby += 1
        existing.price = Math.min(existing.price, doc.price)
        if ((doc.distanceKm ?? 99) < (existing.closestKm ?? 99)) existing.closestKm = doc.distanceKm ?? existing.closestKm
        if (fastestMins != null && (existing.fastestMins == null || fastestMins < existing.fastestMins)) {
          existing.fastestMins = fastestMins
          existing.bestStoreId = doc.storeId
        }
      }
    }

    const hits = [...byProduct.values()]
    const ids = hits.map((h) => h.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: { price: true, brand: true, images: { take: 1 }, inventory: { where: { availableQuantity: { gt: 0 } }, include: { store: true } } },
    })
    for (const hit of hits) {
      const p = products.find((x) => x.id === hit.productId)
      if (!p) continue
      hit.slug = p.slug
      hit.emoji = p.emoji
      hit.mrp = p.price ? Number(p.price.mrp) : hit.price
      hit.onlinePrice = p.price ? Number(p.price.onlinePrice) : undefined
      const best = p.inventory.find((i) => i.storeId === hit.bestStoreId) ?? p.inventory[0]
      if (best) {
        hit.bestStoreName = best.store.name
        hit.confidence = confidence(best.lastUpdatedAt)
      }
    }
    hits.sort((a, b) => sortBy(input.sort, a, b))

    // persist for demand radar (aggregated & anonymised downstream)
    await this.prisma.searchQuery.create({
      data: {
        userId,
        query: input.q,
        parsed: effective as unknown as Record<string, unknown> as never,
        lat: origin.lat,
        lng: origin.lng,
        area: CUSTOMER_HOME.label,
        resultCount: hits.length,
        hadLocal: hits.some((h) => h.storesNearby > 0),
      },
    })
    this.analytics.track({
      name: 'search_performed',
      userId,
      props: { q: input.q, results: hits.length },
      at: Date.now(),
    })

    return {
      parsed: { ...parsed, chips: parsed.chips },
      hits,
      sort: input.sort,
      criteriaVisible: true,
    }
  }

  async autocomplete(prefix: string): Promise<string[]> {
    const q = prefix.toLowerCase().trim()
    if (!q) return ['volleyball', 'school bag', 'printer ink', 'gift under ₹1,000', 'headphones']
    const products = await this.prisma.product.findMany({
      where: { active: true, name: { contains: q, mode: 'insensitive' } },
      select: { name: true },
      take: 5,
    })
    const popular = await this.prisma.searchQuery.groupBy({
      by: ['query'],
      where: { query: { contains: q, mode: 'insensitive' } },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 3,
    })
    return [...products.map((p) => p.name), ...popular.map((p) => p.query)].slice(0, 6)
  }

  async popular(): Promise<{ query: string; count: number }[]> {
    const rows = await this.prisma.searchQuery.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 8,
    })
    return rows.map((r) => ({ query: r.query, count: r._count.query }))
  }
}

function sortBy(sort: string, a: ProductHit, b: ProductHit): number {
  switch (sort) {
    case 'cheapest':
      return a.price - b.price
    case 'nearest':
      return (a.closestKm ?? 99) - (b.closestKm ?? 99)
    case 'rating':
      return b.rating - a.rating
    case 'available':
    case 'fastest':
      return Number(b.pickupToday) - Number(a.pickupToday) || (a.closestKm ?? 99) - (b.closestKm ?? 99)
    default:
      return b.storesNearby - a.storesNearby || (a.closestKm ?? 99) - (b.closestKm ?? 99)
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get()
  search(@Query(new ZodValidationPipe(searchQuerySchema)) input: SearchInput, @CurrentUser() user?: AuthUser) {
    return this.service.search(input, user?.id)
  }

  @Public()
  @Get('autocomplete')
  autocomplete(@Query('q') q = '') {
    return this.service.autocomplete(q)
  }

  @Public()
  @Get('popular')
  popular() {
    return this.service.popular()
  }
}


@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
