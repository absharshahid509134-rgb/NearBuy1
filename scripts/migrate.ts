/**
 * migrate — applies SQL migrations from packages/database/prisma/migrations to
 * the target database and records them in `_prisma_migrations` (same table
 * `prisma migrate deploy` uses), so environments that run the Prisma CLI and
 * environments that cannot download Prisma engines stay in sync.
 *
 * Usage: npx tsx scripts/migrate.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'packages/database/prisma/migrations')

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`)

    const applied = new Set(
      (await client.query<{ migration_name: string }>('SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL')).rows.map(
        (r) => r.migration_name,
      ),
    )

    const dirs = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()

    for (const name of dirs) {
      if (applied.has(name)) {
        console.log(`[migrate] skip  ${name}`)
        continue
      }
      const file = path.join(MIGRATIONS_DIR, name, 'migration.sql')
      if (!fs.existsSync(file)) continue
      const sql = fs.readFileSync(file)
      const checksum = crypto.createHash('sha256').update(sql).digest('hex')
      console.log(`[migrate] apply ${name}`)
      await client.query('BEGIN')
      try {
        await client.query(sql.toString('utf8'))
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
           VALUES ($1, $2, now(), $3, 1)`,
          [crypto.randomUUID(), checksum, name],
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }
    console.log('[migrate] done')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
