/**
 * Prisma client factory.
 *
 * Uses the WASM query engine + pg driver adapter (no native engine download
 * required). Works in every environment, including air-gapped CI.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import type { PrismaClient as PrismaClientNode } from '@prisma/client'
import { PrismaClient as PrismaClientWasm } from '@prisma/client/wasm'

export type Prisma = PrismaClientNode

type ClientOpts = { adapter?: PrismaPg; log?: string[] }

/**
 * PrismaClient bound to the WASM engine + pg adapter. Extend this (e.g. for a
 * Nest injectable) or instantiate via createPrisma().
 */
export const PrismaClientBase = PrismaClientWasm as unknown as {
  new (opts?: ClientOpts): Prisma
}

export function createPgAdapter(connectionString = process.env.DATABASE_URL ?? ''): PrismaPg {
  const pool = new pg.Pool({ connectionString, max: 10 })
  return new PrismaPg(pool)
}

export function createPrisma(connectionString?: string): Prisma {
  return new PrismaClientBase({
    adapter: createPgAdapter(connectionString),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}
