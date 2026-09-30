#!/usr/bin/env node
/**
 * Database bootstrap for a (near-)empty host:
 *  1. applies every SQL migration in packages/database/prisma/migrations
 *  2. seeds demo accounts + stores ONLY when the database is empty
 *
 * Re-runnable: migrations are tracked, seeding is idempotent (skipped when
 * data exists). This is what `npm run db:bootstrap` runs.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const env = { ...process.env }
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://nearbuy:nearbuy@localhost:5432/nearbuy?schema=public'
}
process.env.DATABASE_URL = env.DATABASE_URL

// 1. migrations (scripts/migrate.ts applies only unapplied ones)
const migrate = spawnSync('node', ['--import', 'tsx', path.join(root, 'scripts', 'migrate.ts')], {
  stdio: 'inherit',
  env,
  cwd: root,
})
if (migrate.status !== 0) {
  console.error('[db:bootstrap] migrations failed')
  process.exit(1)
}

// 2. seed only when empty
import pg from 'pg'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM "Store"')
await db.end()

if (rows[0].n > 0) {
  console.log(`[db:bootstrap] database already has ${rows[0].n} stores — skipping seed`)
} else {
  console.log('[db:bootstrap] empty database — seeding demo data')
  const seed = spawnSync('node', ['--import', 'tsx', path.join(root, 'packages', 'database', 'prisma', 'seed.ts')], {
    stdio: 'inherit',
    env,
    cwd: root,
  })
  if (seed.status !== 0) {
    console.error('[db:bootstrap] seed failed')
    process.exit(1)
  }
}
console.log('[db:bootstrap] done')
