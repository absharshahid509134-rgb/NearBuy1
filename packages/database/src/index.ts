import type { PrismaClient } from '@prisma/client'
import { createPrisma } from './client'

/**
 * Shared Prisma client. Provider-agnostic access layer — services in the API
 * (and future workers) use this instead of instantiating their own clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
export { createPrisma, createPgAdapter, PrismaClientBase } from './client'

/** Availability is ALWAYS computed — never trusted from clients. */
export function computeAvailable(quantity: number, reservedQuantity: number): number {
  return Math.max(0, quantity - reservedQuantity)
}

/** Availability confidence from inventory freshness (minutes since update). */
export function availabilityConfidence(lastUpdatedAt: Date, now = new Date()): 'FRESH' | 'STALE' | 'UNKNOWN' {
  const mins = Math.floor((now.getTime() - lastUpdatedAt.getTime()) / 60000)
  if (mins <= 60) return 'FRESH'
  if (mins <= 480) return 'STALE'
  return 'UNKNOWN'
}
