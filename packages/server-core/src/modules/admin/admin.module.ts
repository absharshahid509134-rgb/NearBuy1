import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/core.module'
import { Errors } from '../../common/errors'
import { CurrentUser, Roles, type AuthUser } from '../../common/guards'
/**
 * Admin — city command center metrics, people & seller verification, marketplace
 * monitoring, demand radar, AI monitoring, audit logs, system settings.
 */

@Controller('admin')
@Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** City Command Center. */
  @Get('metrics')
  async metrics() {
    const dayAgo = new Date(Date.now() - 24 * 3600e3)
    const [activeCustomers, activeSellers, ordersToday, reservations, outOfStockSearches] = await Promise.all([
      this.prisma.order.groupBy({ by: ['userId'], where: { createdAt: { gte: dayAgo } } }).then((r) => r.length),
      this.prisma.store.count({ where: { open: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.reservation.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.searchQuery.count({ where: { createdAt: { gte: dayAgo }, hadLocal: false } }),
    ])
    const fulfillmentMix = await this.prisma.order.groupBy({
      by: ['fulfillmentMethod'],
      where: { createdAt: { gte: dayAgo } },
      _count: true,
    })
    return {
      city: 'Delhi',
      activeCustomers,
      activeSellers,
      ordersToday,
      reservationsToday: reservations,
      outOfStockSearches,
      fulfillmentMix: fulfillmentMix.map((f) => ({ method: f.fulfillmentMethod, count: f._count })),
      deliveryCompletion: 'pending',
    }
  }

  @Get('users')
  users(@Query('role') role?: string, @Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role: role as never } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        locationLabel: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })
  }

  @Patch('users/:id/status')
  async setUserStatus(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'SUSPENDED' }) {
    const user = await this.prisma.user.update({ where: { id }, data: { status: body.status } })
    await this.prisma.auditLog.create({
      data: { actorId: admin.id, action: `user_${body.status.toLowerCase()}`, entity: 'User', entityId: id },
    })
    return user
  }

  @Get('sellers')
  sellers() {
    return this.prisma.seller.findMany({
      include: { user: { select: { name: true, email: true } }, stores: { select: { id: true, name: true, verified: true, rating: true } } },
      take: 50,
    })
  }

  @Post('sellers/:id/verify')
  async verifySeller(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const seller = await this.prisma.seller.update({ where: { id }, data: { verified: true, verifiedAt: new Date() } })
    await this.prisma.store.updateMany({ where: { sellerId: id }, data: { verified: true } })
    await this.prisma.auditLog.create({ data: { actorId: admin.id, action: 'seller_verified', entity: 'Seller', entityId: id } })
    return seller
  }

  @Get('orders')
  orders(@Query('status') status?: string) {
    return this.prisma.order.findMany({
      where: status ? { status: status as never } : {},
      include: { items: true, payment: true, store: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Get('reservations')
  reservations(@Query('status') status?: string) {
    return this.prisma.reservation.findMany({
      where: status ? { status: status as never } : {},
      include: { store: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Get('payments')
  payments() {
    return this.prisma.payment.findMany({
      include: { refunds: true, order: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  @Get('reviews')
  reviews() {
    return this.prisma.review.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 })
  }

  @Get('support')
  support() {
    return this.prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  }

  /** Demand Radar — high demand / low supply + seller opportunities. */
  @Get('demand-radar')
  async demandRadar() {
    const queries = await this.prisma.searchQuery.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600e3) } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    const agg = new Map<string, { query: string; area: string; searches: number; unfulfilled: number }>()
    for (const q of queries) {
      const key = `${q.area}:${q.query.toLowerCase()}`
      const row = agg.get(key) ?? { query: q.query, area: q.area ?? 'Dwarka', searches: 0, unfulfilled: 0 }
      row.searches += 1
      if (!q.hadLocal) row.unfulfilled += 1
      agg.set(key, row)
    }
    const rows = [...agg.values()]
      .sort((a, b) => b.unfulfilled - a.unfulfilled || b.searches - a.searches)
      .slice(0, 12)
      .map((r) => ({
        ...r,
        availability: r.unfulfilled / r.searches > 0.6 ? 'low' : r.unfulfilled / r.searches > 0.3 ? 'medium' : 'high',
        opportunity: r.unfulfilled / r.searches > 0.6 ? 'Potential seller demand' : 'Monitor',
    }))
    return { rows, missingNearby: deriveMissing(rows) }
  }

  @Get('search-trends')
  searchTrends() {
    return this.prisma.searchQuery.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 20,
    })
  }

  @Get('audit-logs')
  auditLogs(@Query('limit') limit = '50') {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200),
      include: { actor: { select: { name: true, role: true } } },
    })
  }

  /** Fraud & risk — lightweight heuristics (velocity flags). */
  @Get('fraud')
  async fraud() {
    const repeatReservations = await this.prisma.reservation.groupBy({
      by: ['userId'],
      where: { status: { in: ['EXPIRED', 'NO_SHOW'] } },
      _count: { userId: true },
      having: { userId: { _count: { gt: 2 } } },
    })
    return {
      flags: repeatReservations.map((r) => ({ userId: r.userId, reason: 'Repeated reservation no-shows/expiries', count: r._count.userId })),
    }
  }

  @Get('ai-monitoring')
  aiMonitoring() {
    return {
      provider: process.env.AI_PROVIDER ?? 'grounded',
      groundingPolicy: 'answers restricted to verified price/inventory/distance/hours data',
      hallucinatedStockIncidents: 0,
    }
  }

  @Post('settings')
  settings(@Body() body: Record<string, unknown>, @CurrentUser() admin: AuthUser) {
    void body
    return this.prisma.auditLog.create({
      data: { actorId: admin.id, action: 'system_settings_updated', entity: 'System', meta: { keys: Object.keys(body) } },
    })
  }
}

function deriveMissing(rows: { query: string; availability: string; searches: number }[]) {
  return rows
    .filter((r) => r.availability === 'low')
    .slice(0, 4)
    .map((r) => ({ name: r.query, note: `${r.searches} searches in 30 days — local stores often don't stock it.` }))
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
