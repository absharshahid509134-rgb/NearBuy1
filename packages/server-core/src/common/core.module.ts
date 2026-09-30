import { Global, Injectable, Module, OnModuleInit, type DynamicModule } from '@nestjs/common'
import { ConfigService } from './config.service'
import type { PrismaClient } from '@prisma/client'
import { PrismaClientBase, createPgAdapter } from '@nearbuy/database'
import { createMapProvider, type MapProvider } from '@nearbuy/maps'
import { createSearchEngine, type SearchEngine } from '@nearbuy/search'
import { createPaymentProvider, type PaymentProvider } from '@nearbuy/payments'
import { NotificationBus, type NotificationMessage, type NotificationChannel, type NotificationPorts } from '@nearbuy/notifications'
import { createAnalytics, type AnalyticsProvider } from '@nearbuy/analytics'
import { createLlmProvider, type LlmProvider } from './ai-provider'
/**
 * CoreModule — global providers: Prisma, cache (Redis or memory), and all
 * third-party services behind interfaces (maps/search/payments/notifications/
 * analytics/AI). Nothing else in the codebase talks to vendors directly.
 */

@Injectable()
export class PrismaService extends (PrismaClientBase as unknown as { new (opts?: unknown): PrismaClient }) implements OnModuleInit {
  constructor() {
    super({ adapter: createPgAdapter() })
  }
  async onModuleInit() {
    await this.$connect()
  }
}

export interface CacheStore {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  incr(key: string, ttlSeconds: number): Promise<number>
}

export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, { v: unknown; exp: number }>()
  private counters = new Map<string, { n: number; exp: number }>()

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key)
    if (!hit) return null
    if (hit.exp < Date.now()) {
      this.store.delete(key)
      return null
    }
    return hit.v as T
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 })
  }
  async del(key: string): Promise<void> {
    this.store.delete(key)
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const hit = this.counters.get(key)
    const now = Date.now()
    if (!hit || hit.exp < now) {
      this.counters.set(key, { n: 1, exp: now + ttlSeconds * 1000 })
      return 1
    }
    hit.n += 1
    return hit.n
  }
}

/** Redis-backed cache — used when REDIS_URL is set and ioredis is installed. */
export class RedisCacheStore implements CacheStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly redis: any) {}
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  }
  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.redis.incr(key)
    if (n === 1) await this.redis.expire(key, ttlSeconds)
    return n
  }
}

async function createCache(url?: string): Promise<CacheStore> {
  if (!url) return new MemoryCacheStore()
  try {
    const { Redis } = await import('ioredis')
    const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
    await redis.connect()
    return new RedisCacheStore(redis)
  } catch {
    return new MemoryCacheStore()
  }
}

function notificationPorts(prisma: PrismaClient): NotificationPorts {
  return {
    async persistInApp(msg: NotificationMessage) {
      await prisma.notification.create({
        data: {
          userId: msg.userId,
          event: msg.event,
          title: msg.title,
          body: msg.body,
          channel: 'IN_APP',
        },
      })
    },
    async enqueueOutbound(msg: NotificationMessage, channel: NotificationChannel) {
      // Outbox for async workers (email/SMS/push/WhatsApp). Persisted for auditability.
      await prisma.notification.create({
        data: {
          userId: msg.userId,
          event: msg.event,
          title: msg.title,
          body: msg.body,
          channel: `OUTBOX:${channel}`,
        },
      })
    },
  }
}

export const INJECTION = {
  MAP: 'MAP_PROVIDER',
  SEARCH: 'SEARCH_ENGINE',
  PAYMENTS: 'PAYMENT_PROVIDER',
  NOTIFY: 'NOTIFICATION_BUS',
  ANALYTICS: 'ANALYTICS',
  LLM: 'LLM_PROVIDER',
  CACHE: 'CACHE_STORE',
} as const

@Global()
@Module({})
export class CoreModule {
  static forRoot(): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        ConfigService,
        PrismaService,
        {
          provide: INJECTION.CACHE,
          useFactory: () => createCache(process.env.REDIS_URL),
        },
        {
          provide: INJECTION.MAP,
          useFactory: (): MapProvider =>
            createMapProvider(
              (process.env.MAPS_PROVIDER as 'haversine' | 'google') ?? 'haversine',
              process.env.MAPS_API_KEY,
            ),
        },
        {
          provide: INJECTION.SEARCH,
          useFactory: (): SearchEngine =>
            createSearchEngine(
              (process.env.SEARCH_PROVIDER as 'sql' | 'opensearch') ?? 'sql',
              process.env.OPENSEARCH_URL,
            ),
        },
        {
          provide: INJECTION.PAYMENTS,
          useFactory: (): PaymentProvider =>
            createPaymentProvider(
              (process.env.PAYMENT_PROVIDER as 'mock' | 'razorpay') ?? 'mock',
              process.env.PAYMENT_KEY,
              process.env.PAYMENT_SECRET,
            ),
        },
        {
          provide: INJECTION.NOTIFY,
          useFactory: (prisma: PrismaClient) => new NotificationBus(notificationPorts(prisma)),
          inject: [PrismaService],
        },
        { provide: INJECTION.ANALYTICS, useFactory: (): AnalyticsProvider => createAnalytics() },
        {
          provide: INJECTION.LLM,
          useFactory: (): LlmProvider =>
            createLlmProvider(
              (process.env.AI_PROVIDER as 'grounded' | 'llm') ?? 'grounded',
              process.env.AI_API_KEY,
              process.env.AI_MODEL,
            ),
        },
      ],
      exports: [
        ConfigService,
        PrismaService,
        INJECTION.CACHE,
        INJECTION.MAP,
        INJECTION.SEARCH,
        INJECTION.PAYMENTS,
        INJECTION.NOTIFY,
        INJECTION.ANALYTICS,
        INJECTION.LLM,
      ],
    }
  }
}
