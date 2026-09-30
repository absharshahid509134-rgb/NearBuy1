/**
 * dev-db — boots an embedded PostgreSQL for local development (§60).
 *
 * - data dir: ./.pgdata (gitignored)
 * - user/password: nearbuy/nearbuy
 * - port: 5432
 * - databases: nearbuy, nearbuy_test
 *
 * Usage: npx tsx scripts/dev-db.ts   (Ctrl+C to stop; data persists)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, '.pgdata')
const PORT = Number(process.env.PGPORT ?? 5432)

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'nearbuy',
    password: 'nearbuy',
    port: PORT,
    persistent: true,
    onLog: (msg: string) => {
      // always surface postgres errors; everything else is opt-in
      if (process.env.PG_VERBOSE || /FATAL|ERROR|PANIC/.test(msg)) console.log(msg)
    },
  })

  console.log(`[dev-db] embedded PostgreSQL at ${DATA_DIR}`)
  // initdb only once — the data dir persists across restarts
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    await pg.initialise()
    console.log('[dev-db] data directory initialised')
  } else {
    console.log('[dev-db] data directory already initialised')
  }
  // clean stale pid file left behind when a previous run was killed
  const pidFile = path.join(DATA_DIR, 'postmaster.pid')
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile)
    console.log('[dev-db] removed stale postmaster.pid')
  }
  // postgres refuses loose directory modes (workspace restores can strip them)
  fs.chmodSync(DATA_DIR, 0o700)
  await pg.start()
  console.log(`[dev-db] listening on 127.0.0.1:${PORT} as user "nearbuy"`)

  for (const db of ['nearbuy', 'nearbuy_test']) {
    try {
      await pg.createDatabase(db)
      console.log(`[dev-db] created database ${db}`)
    } catch {
      console.log(`[dev-db] database ${db} already exists`)
    }
  }
  console.log('[dev-db] ready — run `npm run db:migrate && npm run db:seed` to bootstrap the schema.')

  const stop = async () => {
    console.log('\n[dev-db] stopping …')
    await pg.stop().catch(() => undefined)
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((err) => {
  console.error('[dev-db] failed:', err)
  process.exit(1)
})
